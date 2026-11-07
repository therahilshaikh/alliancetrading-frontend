import { broadcastAuth, withRefreshLock } from './broadcast'
import { emitSessionEnd } from './events'
import { tokenStore, type AdminProfile, type AuthTokens } from './tokenStore'

const baseUrl = () => (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

const SKEW_MS = 60_000

/** Login and refresh return the same body (AuthResponse). */
export interface AuthResponseBody {
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  admin?: AdminProfile
}

/** Validated session from a login/refresh response, or null if incomplete. */
export function toAuthTokens(body: AuthResponseBody): AuthTokens | null {
  if (!body.accessToken || !body.refreshToken || !body.expiresAt || !body.admin?.id) return null
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    expiresAt: body.expiresAt,
    admin: body.admin,
  }
}

/**
 * End the browser's session. All tabs of this browser share one session
 * (doc §5.3), so they all clear. Other devices keep their own sessions.
 */
export function endSession() {
  tokenStore.clear()
  broadcastAuth({ type: 'session_ended' })
  emitSessionEnd('session_expired')
}

/**
 * Refresh the access token. Single-flight per tab: concurrent callers share
 * one promise. Cross-tab: serialized via the Web Locks API so only one tab
 * performs the POST, then the new tokens are broadcast to the others.
 *
 * Returns true on success. A refused refresh (SESSION_REPLACED, TOKEN_EXPIRED,
 * UNAUTHENTICATED) ends the session; a network error keeps it.
 */
export function refreshTokens(): Promise<boolean> {
  inflight ??= doRefresh().finally(() => {
    inflight = null
  })
  return inflight
}

let inflight: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  const accessBefore = tokenStore.getAccessToken()
  return withRefreshLock(async () => {
    // Another tab may have refreshed while we waited for the lock and shared
    // the new tokens with us; using them avoids presenting a rotated token.
    const accessNow = tokenStore.getAccessToken()
    if (accessNow && accessNow !== accessBefore && !expiringSoon()) return true

    const refreshToken = tokenStore.getRefreshToken()
    if (!refreshToken) return false

    let res: Response
    try {
      res = await fetch(`${baseUrl()}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
    } catch {
      // Network error: keep the session, let the caller retry later.
      return false
    }

    if (res.ok) {
      const tokens = toAuthTokens((await res.json()) as AuthResponseBody)
      if (!tokens) return false
      tokenStore.setTokens(tokens)
      broadcastAuth({ type: 'tokens', tokens })
      return true
    }

    endSession()
    return false
  })
}

/** Milliseconds until the proactive refresh point (JWT `exp` minus 60s). */
export function msUntilProactiveRefresh(now = Date.now()): number | null {
  const exp = tokenStore.getExpiresAt()
  if (exp === null) return null
  return exp - SKEW_MS - now
}

/** True when the access token expires within the next 60s (or is unreadable). */
export function expiringSoon(now = Date.now()): boolean {
  const ms = msUntilProactiveRefresh(now)
  return ms === null || ms <= 0
}
