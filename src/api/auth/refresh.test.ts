import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { makeJwt, refreshExpiry, TEST_ADMIN } from '@/test/jwt'
import { expiringSoon, refreshTokens, toAuthTokens } from './refresh'
import { tokenStore } from './tokenStore'
import { onSessionEnd } from './events'

const FRESH = makeJwt(30 * 60, 'ADMIN', 'fresh')
const TOKENS = {
  accessToken: FRESH,
  refreshToken: 'refresh-2',
  expiresAt: refreshExpiry(),
  admin: TEST_ADMIN,
}

function refreshEndpoint(counter: { calls: number }) {
  return http.post('*/api/v1/auth/refresh', async () => {
    counter.calls += 1
    return HttpResponse.json(TOKENS)
  })
}

beforeEach(() => {
  tokenStore.clear()
  tokenStore.setTokens({
    accessToken: makeJwt(-10, 'ADMIN', 'old'),
    refreshToken: 'old-refresh',
    expiresAt: refreshExpiry(),
    admin: TEST_ADMIN,
  })
})

describe('access-token expiry', () => {
  it('comes from the JWT exp claim, not the login expiresAt (refresh expiry)', () => {
    tokenStore.setTokens({
      accessToken: makeJwt(30 * 60),
      refreshToken: 'r',
      expiresAt: refreshExpiry(),
      admin: TEST_ADMIN, // 30 days away
    })
    const exp = tokenStore.getExpiresAt()!
    expect(exp - Date.now()).toBeLessThan(31 * 60_000)
    expect(expiringSoon()).toBe(false)
    expect(expiringSoon(Date.now() + 29.5 * 60_000)).toBe(true)
  })
})

describe('refreshTokens', () => {
  it('stores new tokens on success', async () => {
    const counter = { calls: 0 }
    server.use(refreshEndpoint(counter))
    expect(await refreshTokens()).toBe(true)
    expect(tokenStore.getAccessToken()).toBe(FRESH)
    expect(tokenStore.getRefreshToken()).toBe('refresh-2')
    expect(counter.calls).toBe(1)
  })

  it('is single-flight: concurrent callers trigger exactly one POST', async () => {
    const counter = { calls: 0 }
    server.use(refreshEndpoint(counter))
    const results = await Promise.all([refreshTokens(), refreshTokens(), refreshTokens()])
    expect(results).toEqual([true, true, true])
    expect(counter.calls).toBe(1)
  })

  it('broadcasts new tokens to other tabs', async () => {
    server.use(refreshEndpoint({ calls: 0 }))
    const postSpy = vi.spyOn(BroadcastChannel.prototype, 'postMessage')
    await refreshTokens()
    expect(postSpy).toHaveBeenCalledWith({ type: 'tokens', tokens: TOKENS })
    postSpy.mockRestore()
  })

  it.each(['SESSION_REPLACED', 'UNAUTHENTICATED', 'TOKEN_EXPIRED'])(
    'ends the shared browser session on 401 %s',
    async (code) => {
      server.use(
        http.post('*/api/v1/auth/refresh', () =>
          HttpResponse.json({ code, status: 401 }, { status: 401 }),
        ),
      )
      const events: string[] = []
      const unsub = onSessionEnd((reason) => events.push(reason))
      const postSpy = vi.spyOn(BroadcastChannel.prototype, 'postMessage')

      expect(await refreshTokens()).toBe(false)
      expect(tokenStore.getAccessToken()).toBeNull()
      expect(tokenStore.getRefreshToken()).toBeNull()
      expect(events).toEqual(['session_expired'])
      // Tabs of this browser share the session, so they are told to clear.
      expect(postSpy).toHaveBeenCalledWith({ type: 'session_ended' })
      postSpy.mockRestore()
      unsub()
    },
  )

  it('returns false when there is no refresh token', async () => {
    tokenStore.clear()
    expect(await refreshTokens()).toBe(false)
  })

  it('keeps the session on network errors', async () => {
    server.use(http.post('*/api/v1/auth/refresh', () => HttpResponse.error()))
    expect(await refreshTokens()).toBe(false)
    expect(tokenStore.getRefreshToken()).toBe('old-refresh')
  })
})

describe('toAuthTokens', () => {
  it('requires the admin profile alongside the tokens', () => {
    expect(toAuthTokens(TOKENS)?.admin.displayName).toBe('Test Admin')
    expect(
      toAuthTokens({ accessToken: FRESH, refreshToken: 'r', expiresAt: refreshExpiry() }),
    ).toBeNull()
  })
})
