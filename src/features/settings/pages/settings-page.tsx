import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfirm } from '@/components/shared/confirm'
import { DataTable } from '@/components/shared/data-table'
import { DateTime, Money } from '@/components/shared/format'
import { DetailList, ErrorState, PageHeader, Panel } from '@/components/shared/layout'
import { MoneyInput, PercentInput } from '@/components/shared/number-input'
import { formatDateTime, formatFraction, formatMoney, humanize } from '@/lib/format'
import { useAuth } from '@/app/auth'
import { useAdminName } from '@/features/admins/api'
import {
  APP_SETTING_KEYS,
  useCancelScheduled,
  useSaveApp,
  useSaveFee,
  useSavePayment,
  useSettings,
  type ScheduledSetting,
} from '../api'
import { EffectiveFrom, istToUtcIso, nowIST, settingsSubmit } from '../effective-from'
import { ChangeSummary } from '../components/change-summary'
import { usePaymentAccounts } from '@/features/payment-accounts/api'
import {
  PaymentAccountChoice,
  type AccountChoiceErrors,
} from '@/features/payment-accounts/components/payment-account-choice'
import {
  accountChoiceSchema,
  savedAccount,
  toAccountRequest,
  type AccountChoice,
} from '@/features/payment-accounts/schemas'

const effective = {
  date: z.string({ message: 'Pick a date' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a time'),
}
const futureCheck = <T extends { date: string; time: string }>(v: T, ctx: z.RefinementCtx) => {
  const iso = istToUtcIso(v.date, v.time)
  if (!iso || Date.parse(iso) < Date.now() - 60_000)
    ctx.addIssue({ code: 'custom', path: ['time'], message: 'Effective time must be now or later' })
}

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Changes are final as soon as you save them. Pick a later effective time to schedule one instead."
      />
      <Tabs defaultValue="current">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="current">Current values</TabsTrigger>
          <TabsTrigger value="payment">Default payment</TabsTrigger>
          <TabsTrigger value="fees">Withdrawal fees</TabsTrigger>
          <TabsTrigger value="app">App settings</TabsTrigger>
        </TabsList>
        <TabsContent value="current" className="space-y-6">
          <CurrentValues />
          <ScheduledList />
        </TabsContent>
        <TabsContent value="payment">
          <PaymentForm />
        </TabsContent>
        <TabsContent value="fees">
          <FeeForm />
        </TabsContent>
        <TabsContent value="app">
          <AppForm />
        </TabsContent>
      </Tabs>
    </>
  )
}

/** Confirm-dialog line for an effective time: applies now, or scheduled. */
function whenText(effectiveFrom: string) {
  return Date.parse(effectiveFrom) <= Date.now() + 60_000
    ? 'This applies immediately and is final; no approval is needed.'
    : `This is final and takes effect at ${formatDateTime(effectiveFrom)} IST. You can cancel it until then.`
}

function appValueLabel(key: string | undefined, value: string | undefined) {
  const def = APP_SETTING_KEYS.find((k) => k.key === key)
  if (value == null) return '—'
  if (def?.kind === 'money') return formatMoney(Number(value))
  if (def?.kind === 'bool') return value === 'true' ? 'On' : 'Off'
  if (def?.kind === 'int' && key === 'bank_change_cooloff_hours') return `${value} hours`
  return value
}

function settingLabel(p: ScheduledSetting) {
  if (p.kind === 'payment') return 'Default payment'
  if (p.kind === 'fees') return `${humanize(p.withdrawalType)} withdrawal fee`
  return APP_SETTING_KEYS.find((k) => k.key === p.key)?.label ?? p.key ?? 'App setting'
}

function settingValue(p: ScheduledSetting): ReactNode {
  if (p.kind === 'payment') {
    return (
      <>
        <Money value={p.fixedAmount} /> · {accountText(p.paymentAccount)}
      </>
    )
  }
  if (p.kind === 'fees') return formatFraction(p.feePct)
  return appValueLabel(p.key, p.value)
}

function CurrentValues() {
  const q = useSettings()
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />
  if (!q.data)
    return <Skeleton className="h-64 w-full max-w-3xl rounded-3xl" aria-label="Loading settings" />
  const { payment, fees, app } = q.data
  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
      <Panel className="p-5">
        <h2 className="mb-3 font-extrabold">Default payment</h2>
        <DetailList
          items={[
            { label: 'Amount', value: <Money value={payment?.fixedAmount} /> },
            { label: 'Account', value: accountText(payment?.paymentAccount) },
            { label: 'Payee', value: payment?.paymentAccount?.payeeName },
            { label: 'Effective since', value: <DateTime value={payment?.effectiveFrom} /> },
          ]}
        />
        <h2 className="mt-6 mb-3 font-extrabold">Withdrawal fees</h2>
        <DetailList
          items={(fees ?? []).map((f) => ({
            label: `${humanize(f.withdrawalType)} withdrawals`,
            value: (
              <>
                {formatFraction(f.feePct)}{' '}
                <span className="text-muted-foreground text-xs">
                  since <DateTime value={f.effectiveFrom} />
                </span>
              </>
            ),
          }))}
        />
      </Panel>
      <Panel className="p-5">
        <h2 className="mb-3 font-extrabold">App settings</h2>
        <DetailList
          items={APP_SETTING_KEYS.map((k) => ({
            label: k.label,
            value: appValueLabel(k.key, app?.[k.key]),
          }))}
        />
      </Panel>
    </div>
  )
}

/** Future-dated changes (soonest first). They can be cancelled until they start. */
function ScheduledList() {
  const q = useSettings()
  const cancel = useCancelScheduled()
  const confirm = useConfirm()
  const { adminId } = useAuth()
  const adminName = useAdminName()

  const columns = useMemo<ColumnDef<ScheduledSetting, unknown>[]>(
    () => [
      {
        id: 'setting',
        header: 'Setting',
        cell: ({ row }) => <span className="font-bold">{settingLabel(row.original)}</span>,
      },
      { id: 'value', header: 'New value', cell: ({ row }) => settingValue(row.original) },
      {
        id: 'effective',
        header: 'Takes effect',
        cell: ({ row }) => <DateTime value={row.original.effectiveFrom} />,
      },
      {
        id: 'by',
        header: 'Saved by',
        cell: ({ row }) =>
          row.original.createdBy === adminId ? 'You' : adminName(row.original.createdBy),
      },
    ],
    [adminId, adminName],
  )

  async function onCancel(s: ScheduledSetting) {
    const ok = await confirm({
      title: 'Cancel this scheduled change?',
      description: 'It won’t take effect; the current value stays as it is.',
      details: [
        { label: 'Setting', value: settingLabel(s) },
        { label: 'New value', value: settingValue(s) },
        { label: 'Takes effect', value: `${formatDateTime(s.effectiveFrom)} IST` },
      ],
      confirmLabel: 'Cancel change',
      destructive: true,
    })
    if (ok) await cancel.mutateAsync({ kind: s.kind, id: s.id })
  }

  return (
    <section aria-labelledby="scheduled-h" className="max-w-5xl space-y-3">
      <h2 id="scheduled-h" className="font-extrabold">
        Scheduled changes
      </h2>
      <DataTable
        label="Scheduled setting changes"
        columns={columns}
        data={q.data?.scheduled}
        getRowId={(s) => `${s.kind}:${s.id}`}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        onRefresh={() => void q.refetch()}
        paging={{ mode: 'client' }}
        emptyTitle="No scheduled changes"
        rowActions={(s) => [
          {
            label: 'Cancel',
            destructive: true,
            disabled: cancel.isPending,
            onSelect: () => void onCancel(s),
          },
        ]}
      />
    </section>
  )
}
const paymentSchema = z
  .object({
    fixedAmount: z.number({ message: 'Enter the amount' }).min(0.01, 'Amount must be more than ₹0'),
    account: accountChoiceSchema,
    ...effective,
  })
  .superRefine(futureCheck)

type PaymentValues = z.infer<typeof paymentSchema>

function PaymentForm() {
  const save = useSavePayment()
  const settings = useSettings()
  const accounts = usePaymentAccounts('ACTIVE')
  const current = settings.data?.payment
  const confirm = useConfirm()
  const [uploading, setUploading] = useState(false)
  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { account: savedAccount(), ...nowIST() } as PaymentValues,
  })
  const { errors } = form.formState

  // Start from the current default once it loads, unless the admin already edited.
  const currentAmount = current?.fixedAmount
  const currentAccountId = current?.paymentAccount?.id
  useEffect(() => {
    if (
      currentAmount !== undefined &&
      !form.getFieldState('fixedAmount').isDirty &&
      form.getValues('fixedAmount') === undefined
    ) {
      form.setValue('fixedAmount', currentAmount)
    }
    const account = form.getValues('account')
    if (currentAccountId && account.mode === 'saved' && !account.paymentAccountId) {
      form.setValue('account', savedAccount(currentAccountId))
    }
  }, [currentAmount, currentAccountId, form])

  /** The account chosen in the picker: a saved one, or the new one being entered. */
  function chosen(choice: AccountChoice) {
    return choice.mode === 'new'
      ? choice
      : accounts.data?.find((a) => a.id === choice.paymentAccountId)
  }

  return (
    <Panel className="max-w-xl p-5">
      <form
        noValidate
        className="space-y-5"
        onSubmit={settingsSubmit(
          form,
          (markSaved) =>
            form.handleSubmit(async (v) => {
              const effectiveFrom = istToUtcIso(v.date, v.time)!
              const ok = await confirm({
                title: 'Save new default payment?',
                description: whenText(effectiveFrom),
                summary: (
                  <ChangeSummary
                    rows={[
                      {
                        label: 'Amount',
                        current: formatMoney(current?.fixedAmount),
                        next: formatMoney(v.fixedAmount),
                      },
                      {
                        label: 'Account',
                        current: accountName(current?.paymentAccount),
                        next: v.account.mode === 'new' ? `${accountName(chosen(v.account))} (new)` : accountName(chosen(v.account)),
                      },
                      {
                        label: 'UPI ID',
                        current: current?.paymentAccount?.vpa,
                        next: chosen(v.account)?.vpa,
                      },
                      {
                        label: 'Payee',
                        current: current?.paymentAccount?.payeeName,
                        next: chosen(v.account)?.payeeName,
                      },
                    ]}
                    effective={`${formatDateTime(effectiveFrom)} IST`}
                  />
                ),
                confirmLabel: 'Save',
              })
              if (!ok) return
              await save.mutateAsync({
                fixedAmount: v.fixedAmount,
                effectiveFrom,
                ...toAccountRequest(v.account),
              })
              markSaved(true)
            }),
          () => {
            // Back to the (refreshed) current default; the effect fills it in.
            form.reset({ account: savedAccount(), ...nowIST() } as PaymentValues)
          },
        )}
      >
        <div className="space-y-2">
          <Label htmlFor="pay-amount">Default amount</Label>
          <Controller
            control={form.control}
            name="fixedAmount"
            render={({ field }) => (
              <MoneyInput
                id="pay-amount"
                value={field.value}
                onChange={field.onChange}
                aria-invalid={!!errors.fixedAmount}
              />
            )}
          />
          {errors.fixedAmount ? (
            <p className="text-destructive text-sm">{errors.fixedAmount.message}</p>
          ) : (
            <p className="text-muted-foreground text-xs">Pre-filled when approving new members.</p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Account members pay into</p>
          <Controller
            control={form.control}
            name="account"
            render={({ field }) => (
              <PaymentAccountChoice
                value={field.value}
                onChange={field.onChange}
                errors={errors.account as AccountChoiceErrors | undefined}
                showQrUpload
                onUploadingChange={setUploading}
                disabled={save.isPending}
              />
            )}
          />
          <p className="text-muted-foreground text-xs">Pre-selected when approving new members.</p>
        </div>
        <EffectiveFields form={form} idPrefix="pay" />
        <Button type="submit" disabled={uploading || save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save change
        </Button>
      </form>
    </Panel>
  )
}

/** Account's display name: its label, or the payee when it has none. */
function accountName(a: { label?: string; payeeName?: string } | undefined): string | undefined {
  return a?.label || a?.payeeName || undefined
}

/** "HDFC current · alliance@okaxis" for a payment account. */
function accountText(a: { label?: string; vpa?: string; payeeName?: string } | undefined): string {
  if (!a) return '—'
  return [a.label || a.payeeName, a.vpa].filter(Boolean).join(' · ') || '—'
}
const feeSchema = z
  .object({
    withdrawalType: z.enum(['PROFIT', 'PRINCIPAL']),
    /** Entered as percent (2 = 2%); sent as a fraction (0.02). */
    feePercent: z
      .number({ message: 'Enter the fee' })
      .min(0, 'Fee can’t be negative')
      .max(99.99, 'Fee must be below 100%'),
    ...effective,
  })
  .superRefine(futureCheck)

function FeeForm() {
  const save = useSaveFee()
  const currentFees = useSettings().data?.fees
  const confirm = useConfirm()
  const form = useForm<z.infer<typeof feeSchema>>({
    resolver: zodResolver(feeSchema),
    defaultValues: { withdrawalType: 'PROFIT', ...nowIST() },
  })
  const { errors } = form.formState
  return (
    <Panel className="max-w-xl p-5">
      <p className="text-muted-foreground mb-4 text-sm">
        Seeded defaults: 2% on profit, 5% on principal.
      </p>
      <form
        noValidate
        className="space-y-5"
        onSubmit={settingsSubmit(
          form,
          // Saved value: the withdrawal type, kept selected after the reset.
          (markSaved: (type: 'PROFIT' | 'PRINCIPAL') => void) =>
            form.handleSubmit(async (v) => {
              const effectiveFrom = istToUtcIso(v.date, v.time)!
              const feePct = Math.round(v.feePercent * 100) / 10_000 // percent → fraction, 4 dp
              const ok = await confirm({
                title: 'Save new withdrawal fee?',
                description: whenText(effectiveFrom),
                summary: (
                  <ChangeSummary
                    context={{
                      label: 'Applies to',
                      value:
                        v.withdrawalType === 'PROFIT'
                          ? 'Profit withdrawals'
                          : 'Principal withdrawals',
                    }}
                    rows={[
                      {
                        label: 'Fee',
                        current: formatFraction(
                          currentFees?.find((x) => x.withdrawalType === v.withdrawalType)?.feePct,
                        ),
                        next: formatFraction(feePct),
                      },
                    ]}
                    effective={`${formatDateTime(effectiveFrom)} IST`}
                  />
                ),
                confirmLabel: 'Save',
              })
              if (!ok) return
              await save.mutateAsync({ withdrawalType: v.withdrawalType, feePct, effectiveFrom })
              markSaved(v.withdrawalType)
            }),
          (withdrawalType) => {
            form.reset({ withdrawalType, ...nowIST() })
          },
        )}
      >
        <div className="space-y-2">
          <Label htmlFor="fee-type">Withdrawal type</Label>
          <Controller
            control={form.control}
            name="withdrawalType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="fee-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROFIT">Profit</SelectItem>
                  <SelectItem value="PRINCIPAL">Principal</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fee-pct">Fee (% of the withdrawal)</Label>
          <Controller
            control={form.control}
            name="feePercent"
            render={({ field }) => (
              <PercentInput
                id="fee-pct"
                allowNegative={false}
                decimalScale={2}
                value={field.value}
                onChange={field.onChange}
                aria-invalid={!!errors.feePercent}
              />
            )}
          />
          {errors.feePercent ? (
            <p className="text-destructive text-sm">{errors.feePercent.message}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Enter 2 for 2%. Stored as a fraction (0.02).
            </p>
          )}
        </div>
        <EffectiveFields form={form} idPrefix="fee" />
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save change
        </Button>
      </form>
    </Panel>
  )
}

const appSchema = z
  .object({
    key: z.string({ message: 'Choose a setting' }).min(1, 'Choose a setting'),
    value: z.string().trim().min(1, 'Enter a value').max(500),
    ...effective,
  })
  .superRefine((v, ctx) => {
    futureCheck(v, ctx)
    const def = APP_SETTING_KEYS.find((k) => k.key === v.key)
    if (def?.kind === 'money' && !/^\d+(\.\d{1,2})?$/.test(v.value))
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a rupee amount' })
    if (def?.kind === 'int' && !/^\d+$/.test(v.value))
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a whole number' })
    if (def?.kind === 'text' && v.key === 'min_app_version' && !/^\d+\.\d+\.\d+$/.test(v.value))
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Use the format 1.2.3' })
  })

function AppForm() {
  const save = useSaveApp()
  const currentApp = useSettings().data?.app
  const confirm = useConfirm()
  const form = useForm<z.infer<typeof appSchema>>({
    resolver: zodResolver(appSchema),
    defaultValues: { value: '', ...nowIST() },
  })
  const key = useWatch({ control: form.control, name: 'key' })
  const def = APP_SETTING_KEYS.find((k) => k.key === key)
  const { errors } = form.formState
  return (
    <Panel className="max-w-xl p-5">
      <form
        noValidate
        className="space-y-5"
        onSubmit={settingsSubmit(
          form,
          (markSaved) =>
            form.handleSubmit(async (v) => {
              const effectiveFrom = istToUtcIso(v.date, v.time)!
              const shown =
                def?.kind === 'money'
                  ? formatMoney(Number(v.value))
                  : def?.kind === 'bool'
                    ? v.value === 'true'
                      ? 'On'
                      : 'Off'
                    : v.value
              const ok = await confirm({
                title: 'Save this setting change?',
                description: whenText(effectiveFrom),
                summary: (
                  <ChangeSummary
                    context={{ label: 'Setting', value: def?.label ?? v.key }}
                    rows={[
                      {
                        label: 'Value',
                        current: appValueLabel(v.key, currentApp?.[v.key]),
                        next: shown,
                      },
                    ]}
                    effective={`${formatDateTime(effectiveFrom)} IST`}
                  />
                ),
                confirmLabel: 'Save',
              })
              if (!ok) return
              await save.mutateAsync({ key: v.key, value: v.value, effectiveFrom })
              markSaved(true)
            }),
          () => {
            form.reset({ value: '', ...nowIST() })
          },
        )}
      >
        <div className="space-y-2">
          <Label htmlFor="app-key">Setting</Label>
          <Controller
            control={form.control}
            name="key"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  form.setValue(
                    'value',
                    APP_SETTING_KEYS.find((k) => k.key === v)?.kind === 'bool' ? 'false' : '',
                  )
                }}
              >
                <SelectTrigger id="app-key" className="w-full" aria-invalid={!!errors.key}>
                  <SelectValue placeholder="Choose a setting" />
                </SelectTrigger>
                <SelectContent>
                  {APP_SETTING_KEYS.map((k) => (
                    <SelectItem key={k.key} value={k.key}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {def ? <p className="text-muted-foreground text-xs">{def.help}</p> : null}
          {errors.key ? <p className="text-destructive text-sm">{errors.key.message}</p> : null}
        </div>
        {def ? (
          <div className="space-y-2">
            <Label htmlFor="app-value">New value</Label>
            {def.kind === 'bool' ? (
              <Controller
                control={form.control}
                name="value"
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <Switch
                      id="app-value"
                      checked={field.value === 'true'}
                      onCheckedChange={(c) => field.onChange(c ? 'true' : 'false')}
                    />
                    <span className="text-sm">{field.value === 'true' ? 'On' : 'Off'}</span>
                  </div>
                )}
              />
            ) : (
              <Input
                id="app-value"
                {...form.register('value')}
                inputMode={def.kind === 'text' ? 'text' : 'decimal'}
                aria-invalid={!!errors.value}
              />
            )}
            {errors.value ? (
              <p className="text-destructive text-sm">{errors.value.message}</p>
            ) : null}
          </div>
        ) : null}
        <EffectiveFields form={form} idPrefix="app" />
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save change
        </Button>
      </form>
    </Panel>
  )
}

/** Shared date+time fields; each form passes its own watched values and setters. */
function EffectiveFields<T extends { date: string; time: string }>({
  form,
  idPrefix,
}: {
  form: UseFormReturn<T>
  idPrefix: string
}) {
  const f = form as unknown as UseFormReturn<{ date: string; time: string }>
  const date = useWatch({ control: f.control, name: 'date' })
  const time = useWatch({ control: f.control, name: 'time' }) ?? ''
  const err = f.formState.errors.date?.message ?? f.formState.errors.time?.message
  const validate = f.formState.isSubmitted
  return (
    <div>
      <EffectiveFrom
        idPrefix={idPrefix}
        date={date}
        time={time}
        onDate={(d) => f.setValue('date', d ?? '', { shouldValidate: validate, shouldDirty: true })}
        onTime={(t) => f.setValue('time', t, { shouldValidate: validate, shouldDirty: true })}
      />
      {err ? <p className="text-destructive mt-1 text-sm">{err}</p> : null}
    </div>
  )
}
