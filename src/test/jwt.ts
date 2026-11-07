import type { AdminProfile } from '@/api/auth/tokenStore'
/** Unsigned JWT with the claims the console reads (role, exp). Tests only. */
export function makeJwt(expInSeconds: number, role: 'ADMIN' | 'SUPER_ADMIN' = 'ADMIN', tag = '') {
  const b64 = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const exp = Math.floor(Date.now() / 1000) + expInSeconds
  return `${b64({ alg: 'HS256' })}.${b64({ sub: 'admin-id', role, type: 'ADMIN', exp, tag })}.sig`
}

export const refreshExpiry = () => new Date(Date.now() + 30 * 86_400_000).toISOString()

/** Admin profile as returned in login/refresh responses. */
export const TEST_ADMIN: AdminProfile = { id: '00000000-0000-4000-8000-000000000001', email: 'admin@test.local', displayName: 'Test Admin', role: 'ADMIN' }
