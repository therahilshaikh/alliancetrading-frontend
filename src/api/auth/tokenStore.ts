import { jwtDecode } from 'jwt-decode'
import type { components } from '@/api/schema'

const REFRESH_KEY = 'at.refreshToken'

/** The signed-in admin, from the login/refresh response. Memory only. */
export type AdminProfile = components['schemas']['AdminProfile']

let accessToken: string | null = null
let accessExpiresAtMs: number | null = null
let refreshExpiresAt: string | null = null
let admin: AdminProfile | null = null

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  /** ISO-8601 UTC instant of the REFRESH token's expiry (not the access token's). */
  expiresAt: string
  admin: AdminProfile
}

/** Access-token expiry from its JWT `exp` claim (ms epoch), or null if unreadable. */
export function accessTokenExpiry(token: string): number | null {
  try {
    const { exp } = jwtDecode<{ exp?: number }>(token)
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

export const tokenStore = {
  getAccessToken: () => accessToken,
  /** Access-token expiry (ms epoch), read from the JWT. */
  getExpiresAt: () => accessExpiresAtMs,
  getRefreshToken: (): string | null => {
    try {
      return sessionStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },
  hasSession: () => tokenStore.getRefreshToken() !== null,
  getAdmin: () => admin,
  /** Full session, used to hand the shared session to a newly opened tab. */
  getTokens(): AuthTokens | null {
    const refreshToken = tokenStore.getRefreshToken()
    if (!accessToken || !refreshToken || !refreshExpiresAt || !admin) return null
    return { accessToken, refreshToken, expiresAt: refreshExpiresAt, admin }
  },
  setTokens(tokens: AuthTokens) {
    accessToken = tokens.accessToken
    accessExpiresAtMs = accessTokenExpiry(tokens.accessToken)
    refreshExpiresAt = tokens.expiresAt
    admin = tokens.admin
    sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken)
  },
  clear() {
    accessToken = null
    accessExpiresAtMs = null
    refreshExpiresAt = null
    admin = null
    try {
      sessionStorage.removeItem(REFRESH_KEY)
    } catch {
      // ignore
    }
  },
}
