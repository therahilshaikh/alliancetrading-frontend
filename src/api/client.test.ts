import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { makeJwt, refreshExpiry, TEST_ADMIN } from '@/test/jwt'
import { apiClient } from './client'
import { tokenStore } from './auth/tokenStore'
import { onSessionEnd } from './auth/events'

const STALE = makeJwt(30 * 60, 'ADMIN', 'stale') // not near expiry: no proactive refresh
const FRESH = makeJwt(30 * 60, 'ADMIN', 'fresh')

beforeEach(() => {
  tokenStore.clear()
  tokenStore.setTokens({
    accessToken: STALE,
    refreshToken: 'r1',
    expiresAt: refreshExpiry(),
    admin: TEST_ADMIN,
  })
})

describe('auth middleware', () => {
  it('attaches Authorization and X-Request-Id', async () => {
    let auth: string | null = null
    let requestId: string | null = null
    server.use(
      http.get('*/api/v1/admin/dashboard', ({ request }) => {
        auth = request.headers.get('Authorization')
        requestId = request.headers.get('X-Request-Id')
        return HttpResponse.json({})
      }),
    )
    await apiClient.GET('/api/v1/admin/dashboard')
    expect(auth).toBe(`Bearer ${STALE}`)
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('refreshes proactively when the JWT exp is within 60s', async () => {
    tokenStore.setTokens({
      accessToken: makeJwt(30),
      refreshToken: 'r1',
      expiresAt: refreshExpiry(),
      admin: TEST_ADMIN,
    })
    let refreshCalls = 0
    let auth: string | null = null
    server.use(
      http.post('*/api/v1/auth/refresh', () => {
        refreshCalls += 1
        return HttpResponse.json({
          accessToken: FRESH,
          refreshToken: 'r2',
          expiresAt: refreshExpiry(),
          admin: TEST_ADMIN,
        })
      }),
      http.get('*/api/v1/admin/dashboard', ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json({})
      }),
    )
    await apiClient.GET('/api/v1/admin/dashboard')
    expect(refreshCalls).toBe(1)
    expect(auth).toBe(`Bearer ${FRESH}`)
  })

  it('concurrent 401s trigger exactly one refresh and each request is retried once', async () => {
    let refreshCalls = 0
    let dashboardCalls = 0
    server.use(
      http.post('*/api/v1/auth/refresh', () => {
        refreshCalls += 1
        return HttpResponse.json({
          accessToken: FRESH,
          refreshToken: 'r2',
          expiresAt: refreshExpiry(),
          admin: TEST_ADMIN,
        })
      }),
      http.get('*/api/v1/admin/dashboard', ({ request }) => {
        dashboardCalls += 1
        if (request.headers.get('Authorization') !== `Bearer ${FRESH}`) {
          return HttpResponse.json({ code: 'TOKEN_EXPIRED' }, { status: 401 })
        }
        return HttpResponse.json({ ok: true })
      }),
    )

    const results = await Promise.all([
      apiClient.GET('/api/v1/admin/dashboard'),
      apiClient.GET('/api/v1/admin/dashboard'),
      apiClient.GET('/api/v1/admin/dashboard'),
    ])

    expect(refreshCalls).toBe(1)
    expect(results.every((r) => r.response.status === 200)).toBe(true)
    expect(dashboardCalls).toBe(6) // 3 originals + 3 retries
  })

  it('SESSION_REPLACED ends the session without attempting a refresh', async () => {
    let refreshCalls = 0
    server.use(
      http.post('*/api/v1/auth/refresh', () => {
        refreshCalls += 1
        return HttpResponse.json({})
      }),
      http.get('*/api/v1/admin/dashboard', () =>
        HttpResponse.json({ code: 'SESSION_REPLACED', status: 401 }, { status: 401 }),
      ),
    )
    const events: string[] = []
    const unsub = onSessionEnd((r) => events.push(r))

    const { response } = await apiClient.GET('/api/v1/admin/dashboard')
    expect(response.status).toBe(401)
    expect(refreshCalls).toBe(0)
    expect(tokenStore.getRefreshToken()).toBeNull()
    expect(events).toEqual(['session_expired'])
    unsub()
  })

  it('returns the 401 without looping when refresh is refused', async () => {
    let dashboardCalls = 0
    server.use(
      http.post('*/api/v1/auth/refresh', () =>
        HttpResponse.json({ code: 'UNAUTHENTICATED' }, { status: 401 }),
      ),
      http.get('*/api/v1/admin/dashboard', () => {
        dashboardCalls += 1
        return HttpResponse.json({ code: 'UNAUTHENTICATED' }, { status: 401 })
      }),
    )
    const { response } = await apiClient.GET('/api/v1/admin/dashboard')
    expect(response.status).toBe(401)
    expect(dashboardCalls).toBe(1)
    expect(tokenStore.getRefreshToken()).toBeNull()
  })
})
