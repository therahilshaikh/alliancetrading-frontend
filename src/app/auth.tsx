import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { baseUrl } from '@/api/client'
import { broadcastAuth, requestSessionFromOtherTabs, subscribeAuth } from '@/api/auth/broadcast'
import { onSessionEnd, type SessionEndReason } from '@/api/auth/events'
import { refreshTokens, toAuthTokens, type AuthResponseBody } from '@/api/auth/refresh'
import { tokenStore, type AdminProfile, type AuthTokens } from '@/api/auth/tokenStore'
import { parseProblem, type ProblemDetail } from '@/api/problem'

export type AdminRole = NonNullable<AdminProfile['role']>
export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated'

export interface LoginResult {
  ok: boolean
  problem?: ProblemDetail
}

interface AuthContextValue {
  status: AuthStatus
  /** The signed-in admin (login/refresh response). UI only; the server enforces permissions. */
  admin: AdminProfile | null
  role: AdminRole | null
  /** Own admin id, used to hide self from approver lists. */
  adminId: string | null
  sessionEndReason: SessionEndReason | null
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  /** Apply a change to the signed-in admin's own profile (e.g. after renaming themselves). */
  updateAdmin: (patch: Partial<AdminProfile>) => void
  /**
   * Replace the session with one the server just issued (e.g. after a
   * password change revoked the old tokens). Shared with other tabs.
   */
  adoptSession: (body: AuthResponseBody) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [admin, setAdmin] = useState<AdminProfile | null>(null)
  const [sessionEndReason, setSessionEndReason] = useState<SessionEndReason | null>(null)

  const applyTokens = useCallback((tokens: AuthTokens) => {
    tokenStore.setTokens(tokens)
    setAdmin(tokens.admin)
    setSessionEndReason(null)
    setStatus('authenticated')
  }, [])

  const clearSession = useCallback(
    (reason: SessionEndReason | null) => {
      tokenStore.clear()
      queryClient.clear()
      setAdmin(null)
      setSessionEndReason(reason)
      setStatus('unauthenticated')
    },
    [queryClient],
  )

  // Restore the session on load: from this tab's sessionStorage (reload), or
  // from another open tab (new tab shares the browser's session, doc §5.3).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!tokenStore.getRefreshToken()) {
        const shared = await requestSessionFromOtherTabs()
        if (cancelled) return
        if (shared) applyTokens(shared)
        else setStatus('unauthenticated')
        return
      }
      const ok = await refreshTokens()
      if (cancelled) return
      const tokens = tokenStore.getTokens()
      if (ok && tokens) applyTokens(tokens)
      else setStatus('unauthenticated')
    })()
    return () => {
      cancelled = true
    }
  }, [applyTokens])

  // Cross-tab messages. All tabs of this browser share one session.
  useEffect(
    () =>
      subscribeAuth((msg) => {
        if (msg.type === 'tokens') applyTokens(msg.tokens)
        else if (msg.type === 'logout') clearSession('logout')
        else if (msg.type === 'session_ended') clearSession('session_expired')
        else if (msg.type === 'session_request') {
          const tokens = tokenStore.getTokens()
          if (tokens) broadcastAuth({ type: 'tokens', tokens })
        }
      }),
    [applyTokens, clearSession],
  )

  // Session-end events from this tab (refused refresh or SESSION_REPLACED).
  useEffect(() => onSessionEnd((reason) => clearSession(reason)), [clearSession])

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      let res: Response
      try {
        res = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
      } catch {
        return { ok: false, problem: { code: 'NETWORK', detail: 'Cannot reach the server' } }
      }
      if (!res.ok) {
        const problem = await parseProblem(res)
        return { ok: false, problem }
      }
      const tokens = toAuthTokens((await res.json()) as AuthResponseBody)
      if (!tokens)
        return { ok: false, problem: { code: 'UNKNOWN', detail: 'Unexpected login response' } }
      applyTokens(tokens)
      broadcastAuth({ type: 'tokens', tokens })
      return { ok: true }
    },
    [applyTokens],
  )

  const logout = useCallback(async () => {
    try {
      const access = tokenStore.getAccessToken()
      await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: access ? { Authorization: `Bearer ${access}` } : undefined,
      })
    } catch {
      // Clear local state even if the call fails.
    }
    broadcastAuth({ type: 'logout' })
    clearSession('logout')
  }, [clearSession])

  const updateAdmin = useCallback(
    (patch: Partial<AdminProfile>) => {
      const tokens = tokenStore.getTokens()
      if (!tokens) return
      const next = { ...tokens, admin: { ...tokens.admin, ...patch } }
      applyTokens(next)
      broadcastAuth({ type: 'tokens', tokens: next })
    },
    [applyTokens],
  )

  const adoptSession = useCallback(
    (body: AuthResponseBody) => {
      const tokens = toAuthTokens(body)
      if (!tokens) return false
      applyTokens(tokens)
      broadcastAuth({ type: 'tokens', tokens })
      return true
    },
    [applyTokens],
  )

  const value = useMemo(
    () => ({
      status,
      admin,
      role: admin?.role ?? null,
      adminId: admin?.id ?? null,
      sessionEndReason,
      login,
      logout,
      updateAdmin,
      adoptSession,
    }),
    [status, admin, sessionEndReason, login, logout, updateAdmin, adoptSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
