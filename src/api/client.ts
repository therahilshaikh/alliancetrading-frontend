import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './schema'
import { endSession, expiringSoon, refreshTokens } from './auth/refresh'
import { tokenStore } from './auth/tokenStore'

async function readProblemCode(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { code?: string }
    return body.code
  } catch {
    return undefined
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

/** Paths that never carry an Authorization header or trigger a refresh-retry. */
const AUTH_WHITELIST = ['/auth/login', '/auth/refresh', '/auth/logout', '/admin/auth/login']

function isAuthPath(pathname: string): boolean {
  return AUTH_WHITELIST.some((p) => pathname.endsWith(p))
}

function withHeaders(request: Request, set: Record<string, string>): Request {
  const headers = new Headers(request.headers)
  for (const [k, v] of Object.entries(set)) headers.set(k, v)
  return new Request(request, { headers })
}

function bearer(request: Request): string | null {
  return request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? null
}

export const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const url = new URL(request.url)
    const extra: Record<string, string> = { 'X-Request-Id': crypto.randomUUID() }
    if (isAuthPath(url.pathname)) return withHeaders(request, extra)

    // Proactive refresh shortly before expiry.
    if (tokenStore.getRefreshToken() && (!tokenStore.getAccessToken() || expiringSoon())) {
      await refreshTokens()
    }
    const access = tokenStore.getAccessToken()
    if (access) extra.Authorization = `Bearer ${access}`
    return withHeaders(request, extra)
  },

  async onResponse({ request, response }) {
    const url = new URL(request.url)
    if (response.status !== 401 || isAuthPath(url.pathname)) return response

    // SESSION_REPLACED = session revoked server-side (or token reuse): a
    // refresh can't help, so end the session straight away (doc §5.4).
    if ((await readProblemCode(response)) === 'SESSION_REPLACED') {
      endSession()
      return response
    }

    // TOKEN_EXPIRED / UNAUTHENTICATED → single-flight refresh, then retry once.
    // If another request already rotated the token since this one was sent,
    // just retry with it. A refused refresh ends the session.
    const sentWith = bearer(request)
    const current = tokenStore.getAccessToken()
    const refreshed = current && current !== sentWith ? true : await refreshTokens()
    if (!refreshed) return response

    const access = tokenStore.getAccessToken()
    if (!access) return response
    return fetch(withHeaders(request, { Authorization: `Bearer ${access}` }))
  },
}

// Generated paths already include the /api/v1 prefix. `fetch` is resolved per
// call so test interceptors (msw) installed after import are honoured.
export const apiClient = createClient<paths>({
  baseUrl,
  fetch: (request) => globalThis.fetch(request),
})
apiClient.use(authMiddleware)

export { baseUrl }
