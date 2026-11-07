import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { idempotencyHeaders, unwrap, unwrapBlob } from '@/api/http'
import type { components } from '@/api/schema'
import { useApiMutation } from '@/lib/mutations'
import { pagedQueryOptions } from '@/lib/query'
import { dashboardKeys } from '@/features/dashboard/api'
import type { PaymentAssignmentRequest } from '@/features/payment-accounts/components/payment-assignment-dialog'

export type UserDetail = components['schemas']['UserDetail']
export type MemberRow = components['schemas']['AdminUserRow']
export type MemberStatus = NonNullable<MemberRow['status']>
export type LedgerEntry = components['schemas']['LedgerEntryView']

export const memberKeys = {
  all: ['members'] as const,
  list: (q: { search?: string; status?: MemberStatus; page: number; size: number }) =>
    ['members', 'list', q] as const,
  detail: (userId: string) => ['members', 'detail', userId] as const,
  ledger: (userId: string) => ['members', 'ledger', userId] as const,
}

export function useMembers(q: {
  search?: string
  status?: MemberStatus
  page: number
  size: number
}) {
  return useQuery({
    queryKey: memberKeys.list(q),
    queryFn: () =>
      unwrap(
        apiClient.GET('/api/v1/admin/users', {
          params: {
            query: { search: q.search || undefined, status: q.status, page: q.page, size: q.size },
          },
        }),
      ),
    ...pagedQueryOptions({ search: q.search, status: q.status }),
  })
}

export function useMember(userId: string | null | undefined) {
  return useQuery({
    queryKey: memberKeys.detail(userId ?? ''),
    queryFn: () =>
      unwrap(
        apiClient.GET('/api/v1/admin/users/{userId}', { params: { path: { userId: userId! } } }),
      ),
    enabled: !!userId,
    staleTime: 60_000,
  })
}

/** CursorPage { items, nextCursor } — nextCursor null means the end. */
export function useLedger(userId: string) {
  return useInfiniteQuery({
    queryKey: memberKeys.ledger(userId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        apiClient.GET('/api/v1/admin/users/{userId}/ledger', {
          params: { path: { userId }, query: { cursor: pageParam, limit: 20 } },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

/** Payment QR image (authenticated blob). */
export function fetchPaymentQr(userId: string): Promise<Blob> {
  return unwrapBlob(
    apiClient.GET('/api/v1/admin/users/{userId}/payment-assignment/qr', {
      params: { path: { userId } },
      parseAs: 'blob',
    }),
  )
}

export function useSuspendMember() {
  return useApiMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/users/{userId}/suspend', {
          params: { path: { userId } },
          body: { reason },
        }),
      ),
    success: 'Member suspended. Their sessions were signed out.',
    invalidate: [memberKeys.all, dashboardKeys.all],
  })
}

export function useReactivateMember() {
  return useApiMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/users/{userId}/reactivate', { params: { path: { userId } } }),
      ),
    success: 'Member reactivated',
    invalidate: [memberKeys.all, dashboardKeys.all],
  })
}

export function useChangePaymentAssignment() {
  return useApiMutation({
    mutationFn: ({ userId, payment }: { userId: string; payment: PaymentAssignmentRequest }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/users/{userId}/payment-assignment', {
          params: { path: { userId } },
          body: payment,
          headers: idempotencyHeaders(),
        }),
      ),
    success: 'Payment assignment updated',
    invalidate: [memberKeys.all, dashboardKeys.all],
  })
}

export function useCancelPaymentAssignment() {
  return useApiMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      unwrap(
        apiClient.DELETE('/api/v1/admin/users/{userId}/payment-assignment', {
          params: { path: { userId } },
          headers: idempotencyHeaders(),
        }),
      ),
    success: 'Payment assignment cancelled',
    invalidate: [memberKeys.all, dashboardKeys.all],
  })
}
