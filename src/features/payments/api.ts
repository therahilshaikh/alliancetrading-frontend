import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { idempotencyHeaders, unwrap } from '@/api/http'
import type { components } from '@/api/schema'
import { useApiMutation } from '@/lib/mutations'
import { pagedQueryOptions } from '@/lib/query'
import { dashboardKeys } from '@/features/dashboard/api'

export type Investment = components['schemas']['AdminInvestmentResponse']
export type InvestmentStatus = NonNullable<Investment['status']>

export interface InvestmentListQuery {
  status: InvestmentStatus
  page: number
  size: number
}

export const investmentKeys = {
  all: ['investments'] as const,
  list: (q: InvestmentListQuery) => ['investments', 'list', q] as const,
  detail: (id: string) => ['investments', 'detail', id] as const,
}

/** Paged, newest first. */
export function useInvestments(q: InvestmentListQuery) {
  return useQuery({
    queryKey: investmentKeys.list(q),
    queryFn: () => unwrap(apiClient.GET('/api/v1/admin/investments', { params: { query: q } })),
    ...pagedQueryOptions({ status: q.status }),
  })
}

/** One row by id (side panel / deep link), independent of the loaded page. */
export function useInvestment(id: string | undefined) {
  return useQuery({
    queryKey: investmentKeys.detail(id ?? ''),
    queryFn: () =>
      unwrap(apiClient.GET('/api/v1/admin/investments/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  })
}

const invalidate = [investmentKeys.all, dashboardKeys.all, ['members']]

/** Posts the deposit to the ledger → money-moving, so it carries an Idempotency-Key. */
export function useApproveInvestment() {
  return useApiMutation({
    mutationFn: (id: string) =>
      unwrap(
        apiClient.POST('/api/v1/admin/investments/{id}/approve', {
          params: { path: { id } },
          headers: idempotencyHeaders(),
        }),
      ),
    success: 'Payment approved and posted to the ledger',
    invalidate,
  })
}

export function useRejectInvestment() {
  return useApiMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/investments/{id}/reject', {
          params: { path: { id } },
          body: { reason },
        }),
      ),
    success: 'Payment proof rejected',
    invalidate,
  })
}
