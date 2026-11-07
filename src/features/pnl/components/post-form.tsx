import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { useForm, useWatch, type FieldPath, type PathValue } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { NumericFormat } from 'react-number-format'
import { AlertTriangle, Check, Clock, Loader2, Search, UserPlus, Users, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/shared/combobox'
import { useConfirm } from '@/components/shared/confirm'
import { PlainDatePicker } from '@/components/shared/date-picker'
import { PlainDate } from '@/components/shared/format'
import { Panel } from '@/components/shared/layout'
import { errorMessage } from '@/api/http'
import { formatMoney, formatPercent, initials, todayIST } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/app/auth'
import { useDashboard } from '@/features/dashboard/api'
import { useMembers } from '@/features/members/api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useApprovers, useCreateBatch, useDraftPreview, type Preview } from '../api'
import { LargeChangeBadge, LargeChangeSummary } from './large-change'
import {
  makePnlSchema,
  sumAmounts,
  toBatchRequest,
  toPreviewRequest,
  type Audience,
  type EntryType,
  type PnlBatchRequest,
  type PnlFormValues,
  type SelectedMember,
  type ValueType,
} from '../schemas'

const label = 'text-sm font-bold text-slate-700 dark:text-slate-200'
const PREVIEW_DEBOUNCE_MS = 400

export function PostPnlForm() {
  const today = todayIST()
  const schema = useMemo(() => makePnlSchema(today), [today])
  const confirm = useConfirm()
  const navigate = useNavigate()
  const create = useCreateBatch()
  const { adminId } = useAuth()
  const approvers = useApprovers()
  const activeCount = useDashboard().data?.stats?.activeInvestors?.value

  const defaults: PnlFormValues = {
    audience: 'all',
    entry: 'profit',
    valueType: 'FIXED',
    members: [],
    sessionDate: today,
    approverAdminId: '',
    notes: '',
  }
  const form = useForm<PnlFormValues>({ resolver: zodResolver(schema), defaultValues: defaults })
  const { errors, isSubmitted } = form.formState
  const v = useWatch({ control: form.control }) as PnlFormValues
  const set = <K extends FieldPath<PnlFormValues>>(k: K, val: PathValue<PnlFormValues, K>) =>
    form.setValue(k, val, { shouldValidate: isSubmitted })

  // Debounce the serialized body: a fresh object every render would never settle.
  const previewKey = useDebouncedValue(JSON.stringify(toPreviewRequest(v)), PREVIEW_DEBOUNCE_MS)
  const previewBody = useMemo(() => JSON.parse(previewKey) as PnlBatchRequest | null, [previewKey])
  const preview = useDraftPreview(previewBody)

  const approverOptions = (approvers.data ?? [])
    .filter((a) => a.id !== adminId) // maker can never approve their own batch
    .map((a) => ({
      value: a.id ?? '',
      label: a.email ?? 'Admin',
      hint: a.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin',
    }))

  const isFixed = v.valueType === 'FIXED'
  const sign = v.entry === 'loss' ? '−' : '+'
  const fmtValue = (n: number | undefined) =>
    n === undefined ? '—' : isFixed ? formatMoney(n) : formatPercent(n, 4)

  async function onSubmit(values: PnlFormValues) {
    const total = preview.data?.controlTotal
    const ok = await confirm({
      title: `Send this ${values.entry} for approval?`,
      description:
        'Nothing is posted until the approver reviews the exact allocations and approves.',
      details: [
        { label: 'Transaction', value: values.entry === 'profit' ? 'Profit' : 'Loss' },
        {
          label: 'Method',
          value: values.valueType === 'FIXED' ? 'Fixed ₹ per member' : '% of principal',
        },
        {
          label: 'Recipients',
          value:
            values.audience === 'all' ? 'All active members' : `${values.members.length} selected`,
        },
        ...(total !== undefined && !preview.isError
          ? [{ label: 'Total', value: formatSigned(total) }]
          : []),
        { label: 'Session date', value: <PlainDate value={values.sessionDate} /> },
        {
          label: 'Approver',
          value: approverOptions.find((a) => a.value === values.approverAdminId)?.label,
        },
      ],
      confirmLabel: 'Send for approval',
    })
    if (!ok) return
    await create.mutateAsync(toBatchRequest(values))
    form.reset({
      ...defaults,
      valueType: values.valueType,
      approverAdminId: values.approverAdminId,
    })
    void navigate({ to: '/pnl', search: { tab: 'history' } })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <p className={cn('mb-3', label)}>Recipients</p>
      <div role="radiogroup" aria-label="Recipients" className="mb-6 grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          checked={v.audience === 'all'}
          onSelect={() => set('audience', 'all' as Audience)}
          icon={<Users className="size-5" />}
          title="All active members"
          description={
            activeCount !== undefined
              ? `Every active investment (${activeCount})`
              : 'Every active investment'
          }
        />
        <ChoiceCard
          checked={v.audience === 'selected'}
          onSelect={() => set('audience', 'selected' as Audience)}
          icon={<UserPlus className="size-5" />}
          title="Selected members"
          description="Choose members below and set a value for each"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
        <Panel className="overflow-hidden">
          <section className="p-6" aria-labelledby="pnl-tx">
            <p id="pnl-tx" className={label}>
              Transaction type
            </p>
            <div role="radiogroup" aria-labelledby="pnl-tx" className="mt-3 grid grid-cols-2 gap-3">
              <OptionCard
                tone="profit"
                checked={v.entry === 'profit'}
                onSelect={() => set('entry', 'profit' as EntryType)}
                title="Profit"
                sub="Credit to members"
              />
              <OptionCard
                tone="loss"
                checked={v.entry === 'loss'}
                onSelect={() => set('entry', 'loss' as EntryType)}
                title="Loss"
                sub="Debit from members"
              />
            </div>
          </section>

          <section
            className="border-t border-slate-100 p-6 dark:border-white/5"
            aria-labelledby="pnl-method"
          >
            <p id="pnl-method" className={label}>
              Calculation method
            </p>
            <div
              role="radiogroup"
              aria-labelledby="pnl-method"
              className="mt-3 grid grid-cols-2 gap-3"
            >
              <OptionCard
                tone="brand"
                checked={isFixed}
                onSelect={() => set('valueType', 'FIXED' as ValueType)}
                title="Fixed ₹ per member"
                sub="Same rupee amount for each member"
              />
              <OptionCard
                tone="brand"
                checked={!isFixed}
                onSelect={() => set('valueType', 'PERCENTAGE' as ValueType)}
                title="% of principal"
                sub="Each member’s own principal × %"
              />
            </div>
          </section>

          {v.audience === 'all' ? (
            <section className="border-t border-slate-100 p-6 dark:border-white/5">
              <label htmlFor="pnl-value" className={cn('block', label)}>
                {isFixed ? 'Amount per member' : 'Percentage of each member’s principal'}
              </label>
              <BigValueInput
                id="pnl-value"
                valueType={v.valueType}
                value={v.value}
                onChange={(n) => set('value', n)}
                invalid={!!errors.value}
                suffix={isFixed ? 'per member' : 'of principal'}
              />
              <p
                className={cn(
                  'mt-2 text-xs leading-5',
                  errors.value ? 'text-destructive' : 'text-slate-500 dark:text-slate-400',
                )}
              >
                {errors.value?.message ??
                  (isFixed
                    ? 'Every active member receives exactly this amount.'
                    : 'Members with a larger principal receive more.')}
              </p>
            </section>
          ) : (
            <SelectedMembers
              valueType={v.valueType}
              members={v.members}
              onChange={(m) => set('members', m)}
              errors={errors.members}
            />
          )}

          <section className="grid gap-5 border-t border-slate-100 p-6 sm:grid-cols-2 dark:border-white/5">
            <div className="space-y-2">
              <Label htmlFor="pnl-date" className={label}>
                Session date
              </Label>
              <PlainDatePicker
                id="pnl-date"
                value={v.sessionDate}
                onChange={(d) => set('sessionDate', d ?? '')}
                max={today}
              />
              {errors.sessionDate ? (
                <p className="text-destructive text-xs">{errors.sessionDate.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pnl-approver" className={label}>
                Approver
              </Label>
              <Combobox
                id="pnl-approver"
                options={approverOptions}
                value={v.approverAdminId || undefined}
                onChange={(id) => set('approverAdminId', id ?? '')}
                loading={approvers.isLoading}
                placeholder="Choose a different admin"
                emptyText="No other admins available."
              />
              {errors.approverAdminId ? (
                <p className="text-destructive text-xs">{errors.approverAdminId.message}</p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pnl-notes" className={label}>
                Notes <span className="font-medium text-slate-500">(optional)</span>
              </Label>
              <Textarea
                id="pnl-notes"
                {...form.register('notes')}
                maxLength={1000}
                placeholder="Context for the approver"
                className="rounded-2xl"
              />
            </div>
          </section>

          <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-6 dark:border-white/5 dark:bg-white/[0.02]">
            <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-xs leading-5">
                <strong>Maker-checker:</strong> the approver you choose must be a different admin.
                Nothing posts until they approve, and posted entries can’t be edited.
              </p>
            </div>
            <button
              type="submit"
              disabled={create.isPending}
              className={cn(
                'flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold text-white transition focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40',
                v.entry === 'profit'
                  ? 'bg-brand shadow-brand hover:bg-brand-dark focus-visible:ring-brand/30'
                  : 'bg-rose-600 shadow-[0_20px_50px_-18px_rgb(225_29_72/0.5)] hover:bg-rose-700 focus-visible:ring-rose-500/30',
              )}
            >
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Review and send {v.entry} for approval
            </button>
          </div>
        </Panel>

        <PreviewPanel
          v={v}
          sign={sign}
          fmtValue={fmtValue}
          preview={preview}
          hasInput={previewBody !== null}
        />
      </div>
    </form>
  )
}

function formatSigned(n: number) {
  return `${n < 0 ? '−' : '+'}${formatMoney(Math.abs(n))}`
}

function PreviewPanel({
  v,
  sign,
  fmtValue,
  preview,
  hasInput,
}: {
  v: PnlFormValues
  sign: string
  fmtValue: (n: number | undefined) => string
  preview: { data?: Preview; isFetching: boolean; isPlaceholderData: boolean; error: unknown }
  hasInput: boolean
}) {
  const isFixed = v.valueType === 'FIXED'
  const data = hasInput && !preview.error ? preview.data : undefined
  const allocations = data?.allocations ?? []
  const selectedById = new Map(v.members.map((m) => [m.investmentId, m]))
  const amounts = allocations.map((a) => Math.abs(a.amount ?? 0))
  const min = amounts.length ? Math.min(...amounts) : undefined
  const max = amounts.length ? Math.max(...amounts) : undefined
  const recipients = data
    ? allocations.length
    : v.audience === 'selected'
      ? v.members.length
      : undefined

  // Fixed is plain display arithmetic on what was typed (allowed by §6.4); the total shown is always the server's.
  const fixedEach = isFixed && v.audience === 'all' ? v.value : undefined
  const perMember =
    v.audience === 'all' && isFixed
      ? v.value
        ? `${formatMoney(v.value)} each`
        : '—'
      : min !== undefined && max !== undefined
        ? min === max
          ? `${formatMoney(min)} each`
          : `${formatMoney(min)} – ${formatMoney(max)}`
        : '—'

  return (
    <div>
      <Panel className="p-6">
        <div className="flex items-center justify-between">
          <p className={label}>Live preview</p>
          {preview.isFetching ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Updating…
            </span>
          ) : null}
        </div>
        <div
          className="dark:bg-brand mt-4 rounded-3xl bg-slate-950 p-6 text-white"
          aria-live="polite"
        >
          {!hasInput ? (
            <div className="py-6 text-center">
              <p className="text-sm font-bold text-white/80">Enter a value to see the preview</p>
              <p className="mt-1 text-xs text-white/50">
                {v.audience === 'selected' && !v.members.length
                  ? 'Select members and set their values.'
                  : 'Totals are calculated by the server as you type.'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-white/60">
                Total {v.entry === 'profit' ? 'profit credit' : 'loss debit'}
              </p>
              {data ? (
                <p
                  className={cn(
                    'mt-2 text-4xl font-extrabold tabular-nums',
                    preview.isPlaceholderData && 'opacity-60',
                  )}
                >
                  {formatSigned(data.controlTotal ?? 0)}
                </p>
              ) : preview.error ? (
                <p className="mt-2 text-4xl font-extrabold">—</p>
              ) : (
                <Skeleton className="mt-3 h-10 w-44 bg-white/10" />
              )}
              {fixedEach && data ? (
                <p className="mt-2 text-xs text-white/60 tabular-nums">
                  {formatMoney(fixedEach)} × {allocations.length} members
                </p>
              ) : null}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-[11px] text-white/60">Recipients</p>
                  <p className="mt-1 text-sm font-extrabold">
                    {recipients !== undefined ? `${recipients} members` : '—'}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-[11px] text-white/60">Each member gets</p>
                  <p className="mt-1 text-sm font-extrabold tabular-nums">
                    {perMember === '—' ? perMember : `${sign}${perMember}`}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {hasInput && preview.error ? (
          <div
            role="alert"
            className="mt-4 flex gap-3 rounded-2xl bg-rose-50 p-4 text-rose-800 dark:bg-rose-400/10 dark:text-rose-300"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-xs leading-5">{errorMessage(preview.error)}</p>
          </div>
        ) : null}

        {data?.warnings?.length ? (
          <div className="mt-4 space-y-2">
            <p className={label}>Warnings</p>
            {data.warnings.map((w) => (
              <p
                key={w}
                className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-200"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {w}
              </p>
            ))}
          </div>
        ) : null}

        <LargeChangeSummary
          className="mt-4"
          count={allocations.filter((a) => a.largeChange).length}
          threshold={data?.largeChangeThresholdPct}
        />

        {data && allocations.length > 0 ? (
          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <p className={label}>Per member</p>
              <p className="text-xs font-semibold text-slate-500">{allocations.length} members</p>
            </div>
            <ul aria-label="Amount per member" className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {[...allocations]
                .sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0))
                .map((a) => {
                  const picked = selectedById.get(a.investmentId ?? '')
                  const pct = isFixed ? undefined : v.audience === 'all' ? v.value : picked?.value
                  return (
                    <li
                      key={a.investmentId}
                      className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs dark:bg-white/5"
                    >
                      <span className="min-w-0 text-slate-700 dark:text-slate-200">
                        <span className="block truncate font-bold">
                          {a.fullName ?? picked?.name ?? 'Unnamed member'}
                        </span>
                        <span className="block text-[11px] text-slate-500 tabular-nums">
                          {[
                            a.mobile,
                            `${formatMoney(a.principal)} principal`,
                            pct !== undefined ? fmtValue(pct) : undefined,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={cn(
                            'font-extrabold tabular-nums',
                            (a.amount ?? 0) < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-700 dark:text-emerald-400',
                          )}
                        >
                          {formatSigned(a.amount ?? 0)}
                        </span>
                        {a.largeChange ? (
                          <LargeChangeBadge threshold={data.largeChangeThresholdPct} />
                        ) : null}
                      </span>
                    </li>
                  )
                })}
            </ul>
          </div>
        ) : null}
      </Panel>
    </div>
  )
}

function ChoiceCard({
  checked,
  onSelect,
  icon,
  title,
  description,
}: {
  checked: boolean
  onSelect: () => void
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'focus-visible:ring-brand/20 flex items-center gap-4 rounded-3xl border p-5 text-left transition focus-visible:ring-4 focus-visible:outline-none',
        checked
          ? 'border-brand bg-brand-soft ring-brand/10 dark:bg-brand/15 ring-2'
          : 'hover:border-brand/30 border-slate-200 bg-white dark:border-white/10 dark:bg-white/5',
      )}
    >
      <div
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-2xl',
          checked
            ? 'bg-brand text-white'
            : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300',
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-extrabold">{title}</p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{description}</p>
      </div>
      <div
        className={cn(
          'grid size-5 place-items-center rounded-full border',
          checked ? 'border-brand bg-brand text-white' : 'border-slate-300 dark:border-white/20',
        )}
      >
        {checked ? <Check className="size-3" aria-hidden /> : null}
      </div>
    </button>
  )
}

const OPTION_TONE = {
  profit:
    'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/10 dark:bg-emerald-400/10 dark:text-emerald-300',
  loss: 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-500/10 dark:bg-rose-400/10 dark:text-rose-300',
  brand:
    'border-brand bg-brand-soft text-brand ring-2 ring-brand/10 dark:bg-brand/15 dark:text-indigo-200',
}

function OptionCard({
  tone,
  checked,
  onSelect,
  title,
  sub,
}: {
  tone: keyof typeof OPTION_TONE
  checked: boolean
  onSelect: () => void
  title: string
  sub: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'focus-visible:ring-brand/20 flex items-start justify-between gap-2 rounded-2xl border p-4 text-left transition focus-visible:ring-4 focus-visible:outline-none',
        checked
          ? OPTION_TONE[tone]
          : 'border-slate-200 text-slate-800 hover:border-slate-300 dark:border-white/10 dark:text-slate-200',
      )}
    >
      <span>
        <span className="block text-sm font-extrabold">{title}</span>
        <span className="mt-1 block text-xs opacity-75">{sub}</span>
      </span>
      {checked ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
    </button>
  )
}

function BigValueInput({
  id,
  valueType,
  value,
  onChange,
  invalid,
  suffix,
}: {
  id: string
  valueType: ValueType
  value: number | undefined
  onChange: (n: number | undefined) => void
  invalid?: boolean
  suffix: string
}) {
  const isFixed = valueType === 'FIXED'
  return (
    <div
      className={cn(
        'focus-within:border-brand focus-within:ring-brand/10 mt-3 flex h-16 items-center rounded-2xl border bg-white px-5 focus-within:ring-4 dark:bg-white/5',
        invalid ? 'border-destructive' : 'border-slate-200 dark:border-white/10',
      )}
    >
      {isFixed ? <span className="text-xl font-bold text-slate-500">₹</span> : null}
      <NumericFormat
        id={id}
        value={value ?? ''}
        onValueChange={(x) => onChange(x.floatValue)}
        inputMode="decimal"
        allowNegative={false}
        decimalScale={isFixed ? 2 : 4}
        thousandSeparator={isFixed ? ',' : undefined}
        thousandsGroupStyle="lakh"
        aria-invalid={invalid}
        placeholder="0"
        className="min-w-0 flex-1 bg-transparent px-3 text-2xl font-extrabold tabular-nums outline-none placeholder:text-slate-300"
      />
      {!isFixed ? <span className="mr-3 text-xl font-bold text-slate-500">%</span> : null}
      <span className="text-xs font-bold whitespace-nowrap text-slate-500">{suffix}</span>
    </div>
  )
}

function SmallValueInput({
  valueType,
  value,
  onChange,
  label: aria,
}: {
  valueType: ValueType
  value: number | undefined
  onChange: (n: number | undefined) => void
  label: string
}) {
  const isFixed = valueType === 'FIXED'
  return (
    <div className="focus-within:border-brand flex h-10 w-32 items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-white/5">
      {isFixed ? <span className="text-xs font-bold text-slate-500">₹</span> : null}
      <NumericFormat
        value={value ?? ''}
        onValueChange={(x) => onChange(x.floatValue)}
        inputMode="decimal"
        allowNegative={false}
        decimalScale={isFixed ? 2 : 4}
        aria-label={aria}
        className="min-w-0 flex-1 bg-transparent pl-2 text-sm font-extrabold tabular-nums outline-none"
      />
      {!isFixed ? <span className="text-xs font-bold text-slate-500">%</span> : null}
    </div>
  )
}

function SelectedMembers({
  valueType,
  members,
  onChange,
  errors,
}: {
  valueType: ValueType
  members: SelectedMember[]
  onChange: (m: SelectedMember[]) => void
  errors:
    { message?: string; [i: number]: { value?: { message?: string } } | undefined } | undefined
}) {
  const [shared, setShared] = useState<number | undefined>()
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())
  const list = useMembers({ search: q || undefined, status: 'APPROVED', page: 0, size: 50 })
  const isFixed = valueType === 'FIXED'

  // liveInvestmentId resolves to the member's single live investment server-side. With
  // multi-tranche (VITE_MULTI_INVESTMENT_ENABLED) a member can hold several ACTIVE
  // investments; per-tranche P&L selection needs the members list to expose tranches.
  const visible = (list.data?.items ?? [])
    .filter((m) => m.liveInvestmentId && m.liveInvestmentStatus === 'ACTIVE')
    .map((m) => ({
      investmentId: m.liveInvestmentId!,
      name: m.fullName ?? 'Unnamed member',
      mobile: m.mobile,
    }))
  const selectedIds = new Set(members.map((m) => m.investmentId))
  const allVisibleSelected =
    visible.length > 0 && visible.every((m) => selectedIds.has(m.investmentId))

  function toggle(m: { investmentId: string; name: string; mobile?: string }) {
    onChange(
      selectedIds.has(m.investmentId)
        ? members.filter((x) => x.investmentId !== m.investmentId)
        : [...members, { ...m, value: shared }],
    )
  }
  function update(id: string, value: number | undefined) {
    onChange(members.map((m) => (m.investmentId === id ? { ...m, value } : m)))
  }

  return (
    <section
      className="border-t border-slate-100 dark:border-white/5"
      aria-labelledby="pnl-members"
    >
      <div className="p-6">
        <p id="pnl-members" className={label}>
          Choose members
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Tick members in the list, then set one value for all of them or adjust each one.
        </p>

        {members.length ? (
          <ul aria-label="Selected members" className="mt-4 flex flex-wrap gap-2">
            {members.map((m) => (
              <li
                key={m.investmentId}
                className="bg-brand-soft text-brand dark:bg-brand/15 flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-xs font-bold dark:text-indigo-200"
              >
                {m.name}
                <button
                  type="button"
                  onClick={() => toggle(m)}
                  aria-label={`Remove ${m.name}`}
                  className="hover:bg-brand/15 focus-visible:ring-brand/40 grid size-5 place-items-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label htmlFor="pnl-shared" className={cn('mt-5 block', label)}>
          {isFixed ? 'Amount per member' : 'Percentage of principal'}
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <div className="focus-within:border-brand flex h-14 flex-1 items-center rounded-2xl border border-slate-200 bg-white px-5 dark:border-white/10 dark:bg-white/5">
            {isFixed ? <span className="text-xl font-bold text-slate-500">₹</span> : null}
            <NumericFormat
              id="pnl-shared"
              value={shared ?? ''}
              onValueChange={(x) => setShared(x.floatValue)}
              inputMode="decimal"
              allowNegative={false}
              decimalScale={isFixed ? 2 : 4}
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent px-3 text-xl font-extrabold tabular-nums outline-none placeholder:text-slate-300"
            />
            <span className="text-xs font-bold text-slate-500">{isFixed ? 'each' : '% each'}</span>
          </div>
          <button
            type="button"
            onClick={() => onChange(members.map((m) => ({ ...m, value: shared })))}
            disabled={!shared || members.length === 0}
            className="bg-brand hover:bg-brand-dark min-h-12 rounded-2xl px-5 text-xs font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apply to {members.length || 'selected'} members
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or mobile"
            aria-label="Search members by name or mobile"
            className="focus:border-brand h-11 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-10 text-sm font-semibold outline-none dark:border-white/10 dark:bg-white/5"
          />
        </div>
        <button
          type="button"
          disabled={!visible.length}
          onClick={() => {
            const ids = new Set(visible.map((m) => m.investmentId))
            onChange(
              allVisibleSelected
                ? members.filter((m) => !ids.has(m.investmentId))
                : [
                    ...members,
                    ...visible
                      .filter((m) => !selectedIds.has(m.investmentId))
                      .map((m) => ({ ...m, value: shared })),
                  ],
            )
          }}
          className="text-brand text-xs font-extrabold disabled:opacity-40"
        >
          {allVisibleSelected ? 'Clear visible' : 'Select visible'}
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto border-t border-slate-100 dark:border-white/5">
        {list.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            No members with an active investment match.
          </p>
        ) : (
          visible.map((m) => {
            const sel = members.find((x) => x.investmentId === m.investmentId)
            const idx = members.findIndex((x) => x.investmentId === m.investmentId)
            const err = idx >= 0 ? errors?.[idx]?.value?.message : undefined
            return (
              <div
                key={m.investmentId}
                className={cn(
                  'flex items-center gap-3 border-b border-slate-100 p-4 last:border-0 dark:border-white/5',
                  sel && 'bg-brand/[0.03] dark:bg-brand/5',
                )}
              >
                <Checkbox
                  checked={!!sel}
                  onCheckedChange={() => toggle(m)}
                  aria-label={`Select ${m.name}`}
                  className="data-[state=checked]:border-brand data-[state=checked]:bg-brand size-6 rounded-lg"
                />
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-extrabold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  {initials(m.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{m.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{m.mobile}</p>
                  {err ? (
                    <p className="text-destructive mt-0.5 text-[11px] font-bold">{err}</p>
                  ) : null}
                </div>
                {sel ? (
                  <SmallValueInput
                    valueType={valueType}
                    value={sel.value}
                    onChange={(n) => update(m.investmentId, n)}
                    label={`${isFixed ? 'Amount' : 'Percentage'} for ${m.name}`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(m)}
                    className="text-brand text-xs font-extrabold"
                  >
                    Select
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
      <div className="flex items-center justify-between bg-slate-50 px-5 py-4 dark:bg-white/[0.03]">
        <p
          className={cn(
            'text-xs font-bold',
            errors?.message ? 'text-destructive' : 'text-slate-600 dark:text-slate-300',
          )}
        >
          {errors?.message ??
            `${members.length} ${members.length === 1 ? 'member' : 'members'} selected · ${isFixed ? formatMoney(sumAmounts(members)) : 'server calculates ₹'}`}
        </p>
        {members.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-extrabold text-rose-600"
          >
            Clear all
          </button>
        ) : null}
      </div>
    </section>
  )
}
