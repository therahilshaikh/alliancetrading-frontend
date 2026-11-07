import { describe, expect, it } from 'vitest'
import { makeJwt, refreshExpiry, TEST_ADMIN } from '@/test/jwt'
import { requestSessionFromOtherTabs } from './broadcast'

describe('new tab session handshake', () => {
  it('receives the shared session from an open tab', async () => {
    const tokens = {
      accessToken: makeJwt(1800),
      refreshToken: 'r',
      expiresAt: refreshExpiry(),
      admin: TEST_ADMIN,
    }
    // Simulate an already-open tab answering session requests.
    const otherTab = new BroadcastChannel('auth')
    otherTab.onmessage = (e: MessageEvent<{ type: string }>) => {
      if (e.data.type === 'session_request') otherTab.postMessage({ type: 'tokens', tokens })
    }
    await expect(requestSessionFromOtherTabs(500)).resolves.toEqual(tokens)
    otherTab.close()
  })

  it('resolves null when no other tab is open', async () => {
    await expect(requestSessionFromOtherTabs(50)).resolves.toBeNull()
  })
})
