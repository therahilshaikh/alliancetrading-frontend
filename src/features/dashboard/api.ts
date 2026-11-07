import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { unwrap } from '@/api/http'
import type { components } from '@/api/schema'

export type DashboardSummary = components['schemas']['DashboardSummary']

export const dashboardKeys = {
  all: ['dashboard'] as const,
}

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: () => unwrap(apiClient.GET('/api/v1/admin/dashboard')),
    refetchInterval: 60_000,
  })
}
