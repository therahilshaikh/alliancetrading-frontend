/**
 * Why a session ended.
 * - logout: the admin signed out (this tab or another tab)
 * - session_expired: refresh was refused (expired, revoked or reused token)
 */
export type SessionEndReason = 'logout' | 'session_expired'

type Listener = (reason: SessionEndReason) => void

const listeners = new Set<Listener>()

export function onSessionEnd(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitSessionEnd(reason: SessionEndReason) {
  listeners.forEach((l) => l(reason))
}
