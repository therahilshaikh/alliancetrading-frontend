import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { idempotencyHeaders, unwrap } from '@/api/http'
import type { components } from '@/api/schema'
import { useApiMutation } from '@/lib/mutations'
import { pagedQueryOptions } from '@/lib/query'
import { dashboardKeys } from '@/features/dashboard/api'

export type Withdrawal = components['schemas']['AdminWithdrawalResponse']
export type WithdrawalStatus = NonNullable<Withdrawal['status']>

export interface WithdrawalListQuery {
  /** Omitted = all statuses. */
  status?: WithdrawalStatus
  page: number
  size: number
}

export const withdrawalKeys = {
  all: ['withdrawals'] as const,
  list: (q: WithdrawalListQuery) => ['withdrawals', 'list', q] as const,
  detail: (id: string) => ['withdrawals', 'detail', id] as const,
}

/** Paged, newest first. */
export function useWithdrawals(q: WithdrawalListQuery) {
  return useQuery({
    queryKey: withdrawalKeys.list(q),
    queryFn: () => unwrap(apiClient.GET('/api/v1/admin/withdrawals', { params: { query: q } })),
    ...pagedQueryOptions({ status: q.status }),
  })
}

/** One row by id (side panel / deep link), independent of the loaded page. */
export function useWithdrawal(id: string | undefined) {
  return useQuery({
    queryKey: withdrawalKeys.detail(id ?? ''),
    queryFn: () =>
      unwrap(apiClient.GET('/api/v1/admin/withdrawals/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  })
}

const invalidate = [withdrawalKeys.all, dashboardKeys.all, ['members']]
const path = (id: string) => ({ params: { path: { id } } })

export function useApproveWithdrawal() {
  return useApiMutation({
    mutationFn: (id: string) =>
      unwrap(
        apiClient.POST('/api/v1/admin/withdrawals/{id}/approve', {
          ...path(id),
          headers: idempotencyHeaders(),
        }),
      ),
    success: 'Withdrawal approved',
    invalidate,
  })
}

export function useSecondApproveWithdrawal() {
  return useApiMutation({
    mutationFn: (id: string) =>
      unwrap(
        apiClient.POST('/api/v1/admin/withdrawals/{id}/second-approve', {
          ...path(id),
          headers: idempotencyHeaders(),
        }),
      ),
    success: 'Second approval recorded',
    invalidate,
  })
}

export function useRejectWithdrawal() {
  return useApiMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/withdrawals/{id}/reject', { ...path(id), body: { reason } }),
      ),
    success: 'Withdrawal rejected. Held funds were released.',
    invalidate,
  })
}

/** Moves money out of HELD → idempotent. */
export function useMarkPaid() {
  return useApiMutation({
    mutationFn: ({
      id,
      payoutUtr,
      payoutProofDocumentId,
    }: {
      id: string
      payoutUtr?: string
      payoutProofDocumentId?: string
    }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/withdrawals/{id}/mark-paid', {
          ...path(id),
          body: { payoutUtr, payoutProofDocumentId },
          headers: idempotencyHeaders(),
        }),
      ),
    success: 'Marked as paid',
    invalidate,
  })
}

export function useMarkFailed() {
  return useApiMutation({
    mutationFn: ({ id, failureReason }: { id: string; failureReason: string }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/withdrawals/{id}/mark-failed', {
          ...path(id),
          body: { failureReason },
        }),
      ),
    success: 'Marked as payout failed',
    invalidate,
  })
}
