import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { idempotencyHeaders, unwrap } from '@/api/http'
import type { components } from '@/api/schema'
import { useApiMutation } from '@/lib/mutations'
import { pagedQueryOptions } from '@/lib/query'
import { dashboardKeys } from '@/features/dashboard/api'
import { paymentAccountKeys } from '@/features/payment-accounts/api'

export type KycQueueItem = components['schemas']['KycQueueItem']
export type MemberStatus = NonNullable<KycQueueItem['status']>
export type PaymentAssignmentRequest = components['schemas']['PaymentAssignmentRequest']

export const kycKeys = {
  all: ['kyc'] as const,
  queue: (status: MemberStatus, page: number, size: number) =>
    ['kyc', 'queue', status, page, size] as const,
}

export function useKycQueue(status: MemberStatus, page: number, size: number) {
  return useQuery({
    queryKey: kycKeys.queue(status, page, size),
    queryFn: () =>
      unwrap(apiClient.GET('/api/v1/admin/kyc', { params: { query: { status, page, size } } })),
    ...pagedQueryOptions({ status }),
  })
}

/** Audited reveal. Called on click only; never cached. */
export async function revealIdentity(userId: string, field: 'PAN' | 'AADHAAR'): Promise<string> {
  const res = await unwrap(
    apiClient.GET('/api/v1/admin/kyc/{userId}/identity/{field}', {
      params: { path: { userId, field } },
    }),
  )
  return res.value ?? ''
}

const invalidateAfterDecision = [kycKeys.all, dashboardKeys.all, ['members'], ['bank-accounts']]

export function useApproveKyc() {
  return useApiMutation({
    mutationFn: ({ userId, payment }: { userId: string; payment: PaymentAssignmentRequest }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/users/{userId}/kyc/approve', {
          params: { path: { userId } },
          body: { payment },
          headers: idempotencyHeaders(),
        }),
      ),
    success: 'Account approved and payment assigned',
    invalidate: [...invalidateAfterDecision, paymentAccountKeys.all],
  })
}

export function useRejectKyc() {
  return useApiMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/users/{userId}/kyc/reject', {
          params: { path: { userId } },
          body: { reason },
        }),
      ),
    success: 'Account rejected',
    invalidate: invalidateAfterDecision,
  })
}
