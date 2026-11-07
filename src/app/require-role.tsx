import type { ReactNode } from 'react'
import { useAuth, type AdminRole } from './auth'
import { EmptyState } from '@/components/shared/layout'

/** UI-only role gate; the server still enforces permissions (403). */
export function RequireRole({ requiredRole, children }: { requiredRole: AdminRole; children: ReactNode }) {
  const { role: current } = useAuth()
  if (current !== requiredRole) {
    return (
      <EmptyState
        title="Not available for your role"
        description="This page is limited to super admins."
      />
    )
  }
  return <>{children}</>
}
