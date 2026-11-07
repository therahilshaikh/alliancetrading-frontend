import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { unwrap } from '@/api/http'
import type { components } from '@/api/schema'

export type AdminUser = components['schemas']['AdminUserResponse']
export type AdminDirectoryEntry = components['schemas']['AdminDirectoryEntry']

export const adminKeys = {
  all: ['admins'] as const,
  /** SUPER_ADMIN management list. */
  users: () => [...adminKeys.all, 'users'] as const,
  /** Every admin, readable by any admin; resolves ids to names. */
  directory: () => [...adminKeys.all, 'directory'] as const,
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: () => unwrap(apiClient.GET('/api/v1/admin/admin-users')),
  })
}

/** Every admin (incl. the caller and disabled ones); one cached request shared by all screens. */
export function useAdminDirectory() {
  return useQuery({
    queryKey: adminKeys.directory(),
    queryFn: () => unwrap(apiClient.GET('/api/v1/admin/admin-directory')),
    staleTime: 30 * 60_000,
  })
}

/** Label for an admin: display name, falling back to email. */
export function adminLabel(
  a: { displayName?: string; email?: string } | undefined,
): string | undefined {
  return a?.displayName || a?.email || undefined
}

/** Map admin ids to display names (from the cached directory). */
export function useAdminName() {
  const directory = useAdminDirectory()
  return (id: string | undefined) =>
    id ? (adminLabel(directory.data?.find((a) => a.id === id)) ?? `${id.slice(0, 8)}…`) : '—'
}
