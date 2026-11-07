import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { unwrap } from '@/api/http'
import type { components } from '@/api/schema'
import { formatDateTime } from '@/lib/format'
import { useApiMutation } from '@/lib/mutations'
import { paymentAccountKeys } from '@/features/payment-accounts/api'

export type SettingKind = 'payment' | 'fees' | 'app'

/** Allowed app-setting keys (backend AppSetting constants) and how to edit them. */
export const APP_SETTING_KEYS: {
  key: string
  label: string
  kind: 'money' | 'int' | 'bool' | 'text'
  help: string
}[] = [
  {
    key: 'withdrawal_second_approval_threshold',
    label: 'Second-approval threshold (₹)',
    kind: 'money',
    help: 'Withdrawals at or above this need a second admin.',
  },
  {
    key: 'min_profit_withdrawal',
    label: 'Minimum profit withdrawal (₹)',
    kind: 'money',
    help: 'Smallest profit withdrawal a member can request.',
  },
  {
    key: 'bank_change_cooloff_hours',
    label: 'Bank change cooling-off (hours)',
    kind: 'int',
    help: 'Withdrawals blocked for this long after a bank change.',
  },
  {
    key: 'principal_withdrawal_enabled',
    label: 'Principal withdrawals enabled',
    kind: 'bool',
    help: 'Allow members to request principal exits.',
  },
  {
    key: 'min_app_version',
    label: 'Minimum app version',
    kind: 'text',
    help: 'Older mobile apps are asked to update, e.g. 1.2.0.',
  },
]

export const settingsKeys = { all: ['settings'] as const }

export type SettingsView = components['schemas']['SettingsView']
export type ScheduledSetting = Omit<components['schemas']['ScheduledSetting'], 'id' | 'kind'> & {
  id: string
  kind: SettingKind
}
type SaveResponse = components['schemas']['SettingResponse']

const KIND: Record<string, SettingKind> = { PAYMENT: 'payment', FEE: 'fees', APP: 'app' }

/** GET /admin/settings: current values (defaults filled in) + future-dated changes, soonest first. SUPER_ADMIN only. */
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: async () => {
      const view = await unwrap(apiClient.GET('/api/v1/admin/settings'))
      const scheduled: ScheduledSetting[] = (view.scheduled ?? []).flatMap((s) => {
        const kind = s.kind ? KIND[s.kind] : undefined
        return kind && s.id ? [{ ...s, id: s.id, kind }] : []
      })
      return { ...view, scheduled }
    },
  })
}

// A default-payment save can add an account and changes the approval defaults.
const invalidate = [settingsKeys.all, paymentAccountKeys.all, ['audit']]

/** Saves are final; a future effectiveFrom comes back SCHEDULED. */
function saved(what: string) {
  return (r: SaveResponse | undefined) =>
    r?.status === 'SCHEDULED'
      ? `${what} scheduled for ${formatDateTime(r.effectiveFrom)} IST`
      : `${what} saved`
}

export function useSavePayment() {
  return useApiMutation({
    mutationFn: (body: components['schemas']['PaymentSettingRequest']) =>
      unwrap(apiClient.POST('/api/v1/admin/settings/payment', { body })),
    success: saved('Default payment'),
    invalidate,
  })
}

export function useSaveFee() {
  return useApiMutation({
    mutationFn: (body: components['schemas']['FeeSettingRequest']) =>
      unwrap(apiClient.POST('/api/v1/admin/settings/fees', { body })),
    success: saved('Withdrawal fee'),
    invalidate,
  })
}

export function useSaveApp() {
  return useApiMutation({
    mutationFn: (body: components['schemas']['AppSettingRequest']) =>
      unwrap(apiClient.POST('/api/v1/admin/settings/app', { body })),
    success: saved('Setting'),
    invalidate,
  })
}

/** DELETE a change that hasn't started yet (409 once it has). */
export function useCancelScheduled() {
  return useApiMutation({
    mutationFn: ({ kind, id }: { kind: SettingKind; id: string }) =>
      unwrap(
        apiClient.DELETE('/api/v1/admin/settings/{kind}/{id}', { params: { path: { kind, id } } }),
      ),
    success: 'Scheduled change cancelled',
    invalidate,
  })
}
