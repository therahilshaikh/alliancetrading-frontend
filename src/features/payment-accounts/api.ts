import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { unwrap } from '@/api/http'
import type { components } from '@/api/schema'

export type PaymentAccount = components['schemas']['PaymentAccountResponse']
export type PaymentAccountStatus = NonNullable<PaymentAccount['status']>
export type PaymentAccountRequest = components['schemas']['PaymentAccountRequest']

export const paymentAccountKeys = {
  all: ['payment-accounts'] as const,
  list: (status: PaymentAccountStatus) => ['payment-accounts', 'list', status] as const,
  defaults: ['payment-accounts', 'defaults'] as const,
}

export function usePaymentAccounts(status: PaymentAccountStatus = 'ACTIVE') {
  return useQuery({
    queryKey: paymentAccountKeys.list(status),
    queryFn: () =>
      unwrap(apiClient.GET('/api/v1/admin/payment-accounts', { params: { query: { status } } })),
  })
}

export function usePaymentDefaults() {
  return useQuery({
    queryKey: paymentAccountKeys.defaults,
    queryFn: () => unwrap(apiClient.GET('/api/v1/admin/payment-accounts/defaults')),
  })
}
