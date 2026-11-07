import type { AuthTokens } from './tokenStore'

/**
 * Tabs in the same browser share ONE session (doc §5.3):
 * - tokens:          a tab logged in or refreshed; others adopt the new tokens
 * - logout:          explicit sign-out; all tabs clear
 * - session_ended:   the shared session was refused/revoked; all tabs clear
 * - session_request: a new tab asks for the current session
 */
export type AuthBroadcastMessage =
  | { type: 'tokens'; tokens: AuthTokens }
  | { type: 'logout' }
  | { type: 'session_ended' }
  | { type: 'session_request' }

type Handler = (msg: AuthBroadcastMessage) => void

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel('auth')
  return channel
}

export function broadcastAuth(msg: AuthBroadcastMessage) {
  getChannel()?.postMessage(msg)
}

export function subscribeAuth(handler: Handler): () => void {
  const ch = getChannel()
  if (!ch) return () => {}
  const listener = (event: MessageEvent<AuthBroadcastMessage>) => handler(event.data)
  ch.addEventListener('message', listener)
  return () => ch.removeEventListener('message', listener)
}

/**
 * Ask other tabs for the shared session. Resolves with their tokens, or null
 * if no tab answers within `timeoutMs`.
 */
export function requestSessionFromOtherTabs(timeoutMs = 300): Promise<AuthTokens | null> {
  const ch = getChannel()
  if (!ch) return Promise.resolve(null)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub()
      resolve(null)
    }, timeoutMs)
    const unsub = subscribeAuth((msg) => {
      if (msg.type === 'tokens') {
        clearTimeout(timer)
        unsub()
        resolve(msg.tokens)
      }
    })
    broadcastAuth({ type: 'session_request' })
  })
}

const REFRESH_LOCK = 'auth-refresh'

/** Run `fn` under the cross-tab refresh lock when Web Locks is available. */
export async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK, fn)
  }
  return fn()
}
