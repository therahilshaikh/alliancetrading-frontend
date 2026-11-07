import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { unwrap } from '@/api/http'
import type { components } from '@/api/schema'
import { useApiMutation } from '@/lib/mutations'
import { pagedQueryOptions } from '@/lib/query'
import { dashboardKeys } from '@/features/dashboard/api'

export type BankAccount = components['schemas']['AdminBankAccountResponse']
export type BankStatus = NonNullable<BankAccount['status']>

export interface BankListQuery {
  status: BankStatus
  page: number
  size: number
}

export const bankKeys = {
  all: ['bank-accounts'] as const,
  list: (q: BankListQuery) => ['bank-accounts', 'list', q] as const,
  detail: (id: string) => ['bank-accounts', 'detail', id] as const,
}

/** Paged, newest first. */
export function useBankAccounts(q: BankListQuery) {
  return useQuery({
    queryKey: bankKeys.list(q),
    queryFn: () => unwrap(apiClient.GET('/api/v1/admin/bank-accounts', { params: { query: q } })),
    ...pagedQueryOptions({ status: q.status }),
  })
}

/** One row by id (side panel / deep link), independent of the loaded page. */
export function useBankAccount(id: string | undefined) {
  return useQuery({
    queryKey: bankKeys.detail(id ?? ''),
    queryFn: () =>
      unwrap(apiClient.GET('/api/v1/admin/bank-accounts/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  })
}

/** Audited reveal. Called on click only; never cached. */
export async function revealAccountNumber(id: string): Promise<string> {
  const r = await unwrap(
    apiClient.GET('/api/v1/admin/bank-accounts/{id}/account-number', { params: { path: { id } } }),
  )
  return r.accountNumber ?? ''
}

const invalidate = [bankKeys.all, dashboardKeys.all, ['members'], ['kyc']]

export function useVerifyBank() {
  return useApiMutation({
    mutationFn: (id: string) =>
      unwrap(
        apiClient.POST('/api/v1/admin/bank-accounts/{id}/verify', { params: { path: { id } } }),
      ),
    success: 'Bank account verified',
    invalidate,
  })
}

export function useRejectBank() {
  return useApiMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/bank-accounts/{id}/reject', {
          params: { path: { id } },
          body: { reason },
        }),
      ),
    success: 'Bank account rejected',
    invalidate,
  })
}
