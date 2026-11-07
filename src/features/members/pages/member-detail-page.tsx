import { useMemo, useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Ban, CirclePlus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfirm } from '@/components/shared/confirm'
import { DataTable } from '@/components/shared/data-table'
import { DocumentViewer } from '@/components/shared/document-viewer'
import { DateTime, Money, PlainDate } from '@/components/shared/format'
import { DetailList, EmptyState, ErrorState, PageHeader, Panel } from '@/components/shared/layout'
import { PiiReveal } from '@/components/shared/pii-reveal'
import { StatusBadge, WarningBadge } from '@/components/shared/status-badge'
import { formatMoney, humanize } from '@/lib/format'
import { useObjectUrl } from '@/hooks/use-object-url'
import { namesMatch } from '@/lib/validation'
import { revealIdentity } from '@/features/approvals/api'
import { revealAccountNumber } from '@/features/bank-accounts/api'
import { PaymentAssignmentDialog } from '@/features/payment-accounts/components/payment-assignment-dialog'
import { InvestmentSheet } from '@/features/payments/components/investment-sheet'
import { useInvestment } from '@/features/payments/api'
import { MULTI_INVESTMENT_ENABLED } from '@/lib/flags'
import {
  fetchPaymentQr,
  useCancelPaymentAssignment,
  useChangePaymentAssignment,
  useLedger,
  useMember,
  useReactivateMember,
  useSuspendMember,
  type LedgerEntry,
  type UserDetail,
} from '../api'

const route = getRouteApi('/app/members/$userId')
type Investment = NonNullable<UserDetail['investments']>[number]

export function MemberDetailPage() {
  const { userId } = route.useParams()
  const { tab } = route.useSearch()
  const navigate = route.useNavigate()
  const { data, isLoading, error, refetch } = useMember(userId)
  const confirm = useConfirm()
  const suspend = useSuspendMember()
  const reactivate = useReactivateMember()
  const [assignOpen, setAssignOpen] = useState(false)
  const change = useChangePaymentAssignment()

  if (isLoading) return <Skeleton className="h-96 w-full rounded-3xl" />
  if (error || !data)
    return (
      <Panel>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Panel>
    )

  const p = data.profile
  const name = p?.fullName ?? 'Unnamed member'
  const suspended = p?.status === 'SUSPENDED'

  // The backend consumes the assignment on approval, so an active assignment means a payment is
  // genuinely awaited (it comes back null or inactive otherwise — both treated as "none").
  const a = data.paymentAssignment
  const openAssignment = a && a.active !== false ? a : undefined
  const investments = data.investments ?? []
  const pendingProof = investments.find((i) => i.status === 'PENDING_VERIFICATION')
  const canAddInvestment = MULTI_INVESTMENT_ENABLED && !suspended && p?.status === 'APPROVED'

  async function onAddInvestment() {
    if (openAssignment) {
      const ok = await confirm({
        title: 'Replace the current assignment?',
        description: `The member hasn't paid the current assignment of ${formatMoney(openAssignment.amount)} yet. Replacing it removes that payment request.`,
        confirmLabel: 'Replace assignment',
      })
      if (!ok) return
    }
    setAssignOpen(true)
  }

  async function onSuspend() {
    const res = await confirm({
      title: `Suspend ${name}?`,
      description: 'Suspension blocks login and signs the member out of every device.',
      details: [
        { label: 'Member', value: name },
        { label: 'Mobile', value: p?.mobile },
        { label: 'Current value', value: <Money value={data?.balances?.currentValue} /> },
      ],
      reason: { label: 'Reason', required: true, minLength: 5 },
      confirmLabel: 'Suspend',
      destructive: true,
    })
    if (res?.reason) await suspend.mutateAsync({ userId, reason: res.reason })
  }

  async function onReactivate() {
    const ok = await confirm({
      title: `Reactivate ${name}?`,
      description: `The member returns to their previous status${data?.suspendedFromStatus ? ` (${humanize(data.suspendedFromStatus)})` : ''}.`,
      confirmLabel: 'Reactivate',
    })
    if (ok) await reactivate.mutateAsync({ userId })
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link to="/members" search={{ page: 0, size: 20 }}>
          <ArrowLeft className="size-4" /> Members
        </Link>
      </Button>
      <PageHeader
        eyebrow={p?.mobile}
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p?.status} /> Joined <DateTime value={p?.joinedAt} />
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {canAddInvestment ? (
              <Button
                variant="outline"
                onClick={onAddInvestment}
                disabled={!!pendingProof}
                title={
                  pendingProof
                    ? 'A payment proof is under review — approve or reject it first'
                    : undefined
                }
              >
                <CirclePlus className="size-4" /> Add investment
              </Button>
            ) : null}
            {suspended ? (
              <Button variant="outline" onClick={onReactivate} disabled={reactivate.isPending}>
                <RotateCcw className="size-4" /> Reactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-400/20 dark:text-rose-400"
                onClick={onSuspend}
                disabled={suspend.isPending}
              >
                <Ban className="size-4" /> Suspend
              </Button>
            )}
          </div>
        }
      />

      {suspended ? (
        <p className="mb-6 rounded-2xl bg-slate-100 p-4 text-sm dark:bg-white/5">
          Suspended <DateTime value={data.suspendedAt} />
          {data.suspensionReason ? <> — {data.suspensionReason}</> : null}
        </p>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(v) => void navigate({ search: { tab: v as typeof tab }, replace: true })}
      >
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="bank">Bank account</TabsTrigger>
          <TabsTrigger value="investments">Investments</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Principal', value: <Money value={data.balances?.principal} /> },
              { label: 'Profit', value: <Money value={data.balances?.profit} signed /> },
              { label: 'Held', value: <Money value={data.balances?.held} /> },
              { label: 'Current value', value: <Money value={data.balances?.currentValue} /> },
            ].map((s) => (
              <Panel key={s.label} className="p-5">
                <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  {s.label}
                </p>
                <p className="mt-1 text-xl font-extrabold">{s.value}</p>
              </Panel>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="kyc">
          <Panel className="p-5">
            <DetailList
              items={[
                { label: 'Full name', value: p?.fullName },
                { label: 'Date of birth', value: <PlainDate value={p?.dob} /> },
                { label: 'KYC verified', value: p?.kycVerified ? 'Yes' : 'No' },
                {
                  label: 'PAN',
                  value: (
                    <PiiReveal
                      masked={p?.panMasked}
                      label="PAN"
                      fetchValue={() => revealIdentity(userId, 'PAN')}
                    />
                  ),
                },
                {
                  label: 'Aadhaar',
                  value: (
                    <PiiReveal
                      masked={p?.aadhaarMasked}
                      label="Aadhaar"
                      fetchValue={() => revealIdentity(userId, 'AADHAAR')}
                    />
                  ),
                },
              ]}
            />
          </Panel>
        </TabsContent>

        <TabsContent value="bank">
          <BankTab profile={p} />
        </TabsContent>

        <TabsContent value="investments">
          <InvestmentsTab userId={userId} detail={data} />
        </TabsContent>

        <TabsContent value="ledger">
          <LedgerTab userId={userId} />
        </TabsContent>
      </Tabs>

      <PaymentAssignmentDialog
        key={assignOpen ? 'open' : 'closed'}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        title="Add investment"
        description={
          openAssignment
            ? 'Replace the current payment request with a new amount or account.'
            : 'The member pays this amount on top of any existing principal — it becomes a new, separate investment.'
        }
        memberName={p?.fullName}
        memberMobile={p?.mobile}
        initialAmount={openAssignment?.amount}
        submitLabel={openAssignment ? 'Replace assignment' : 'Assign'}
        confirmTitle={openAssignment ? 'Replace this assignment?' : 'Assign this payment?'}
        confirmDescription="A new investment tranche is created once the member pays and you verify their proof. Existing tranches are unchanged."
        pending={change.isPending}
        onSubmit={(payment) => change.mutateAsync({ userId, payment })}
      />
    </>
  )
}

function BankTab({ profile }: { profile: UserDetail['profile'] }) {
  const bank = profile?.bankAccount
  if (!bank)
    return (
      <Panel>
        <EmptyState title="No bank account" />
      </Panel>
    )
  return (
    <Panel className="space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={bank.status} />
        {!namesMatch(profile?.fullName, bank.holderName) ? (
          <WarningBadge>Name differs from KYC</WarningBadge>
        ) : null}
        {bank.cooloffUntil ? (
          <span className="text-muted-foreground text-xs">
            Withdrawals blocked until <DateTime value={bank.cooloffUntil} /> (bank change
            cooling-off)
          </span>
        ) : null}
      </div>
      <DetailList
        items={[
          { label: 'Holder name', value: bank.holderName },
          {
            label: 'Account',
            value: bank.id ? (
              <PiiReveal
                masked={bank.accountNumberMasked}
                label="account number"
                fetchValue={() => revealAccountNumber(bank.id!)}
              />
            ) : (
              <span className="font-mono">{bank.accountNumberMasked}</span>
            ),
          },
          { label: 'IFSC', value: <span className="font-mono">{bank.ifsc}</span> },
          { label: 'Type', value: humanize(bank.accountType) },
          { label: 'UPI ID', value: bank.vpa },
          { label: 'Added', value: <DateTime value={bank.createdAt} /> },
        ]}
      />
      {bank.rejectionReason ? (
        <p className="text-sm text-rose-700 dark:text-rose-400">Rejected: {bank.rejectionReason}</p>
      ) : null}
      {bank.proofDocumentId ? (
        <DocumentViewer documentId={bank.proofDocumentId} title="Bank proof" />
      ) : null}
      <p className="text-muted-foreground text-xs">
        Only the current account is shown. Pending bank changes are reviewed on{' '}
        <Link to="/bank-accounts" className="text-brand font-semibold hover:underline">
          Bank accounts
        </Link>
        .
      </p>
    </Panel>
  )
}

function InvestmentsTab({ userId, detail }: { userId: string; detail: UserDetail }) {
  const investments = detail.investments
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const detailQuery = useInvestment(selectedId)
  // Row from the loaded list shows instantly; the by-id fetch covers it.
  const selected = selectedId
    ? (detailQuery.data ?? investments?.find((i) => i.id === selectedId))
    : undefined

  const columns = useMemo<ColumnDef<Investment, unknown>[]>(
    () => [
      {
        id: 'amount',
        header: 'Amount',
        cell: ({ row }) => <Money value={row.original.amount} className="font-bold" />,
      },
      {
        id: 'remainingPrincipal',
        header: 'Remaining',
        cell: ({ row }) => <Money value={row.original.remainingPrincipal} />,
      },
      {
        id: 'earnedSoFar',
        header: 'Earned',
        cell: ({ row }) => <Money value={row.original.earnedSoFar} />,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'created',
        header: 'Submitted',
        cell: ({ row }) => <DateTime value={row.original.createdAt} />,
      },
      {
        id: 'approved',
        header: 'Approved',
        cell: ({ row }) => <DateTime value={row.original.approvedAt} />,
      },
    ],
    [],
  )
  return (
    <div className="space-y-4">
      <AssignmentPanel userId={userId} detail={detail} onOpenProof={setSelectedId} />
      <DataTable
        label="Investments"
        columns={columns}
        data={investments ?? []}
        getRowId={(r) => r.id ?? ''}
        paging={{ mode: 'client' }}
        emptyTitle="No investments"
        onRowClick={(r) => setSelectedId(r.id)}
      />
      <InvestmentSheet
        key={selected?.id}
        investment={selected}
        onClose={() => setSelectedId(undefined)}
      />
    </div>
  )
}

function AssignmentPanel({
  userId,
  detail,
  onOpenProof,
}: {
  userId: string
  detail: UserDetail
  onOpenProof: (investmentId: string) => void
}) {
  // Rendered only while a payment is genuinely awaited: the backend consumes the assignment on
  // approval, so an active assignment here always means "member still has to pay this".
  const a0 = detail.paymentAssignment
  const a = a0 && a0.active !== false ? a0 : undefined
  const cancel = useCancelPaymentAssignment()
  const confirm = useConfirm()
  const qr = useObjectUrl(a?.id ? `${userId}:${a.id}` : null, () => fetchPaymentQr(userId))
  // Cancel is rejected server-side while a proof is under review (409 ILLEGAL_STATE_TRANSITION).
  const pendingProof = (detail.investments ?? []).find((i) => i.status === 'PENDING_VERIFICATION')

  async function onCancel() {
    if (!a) return
    const ok = await confirm({
      title: 'Cancel this payment assignment?',
      description: `The member will no longer be asked to pay ${formatMoney(a.amount)}. The assignment is kept in history; assign again to undo.`,
      details: [
        { label: 'Member', value: detail.profile?.fullName ?? detail.profile?.mobile },
        { label: 'UPI ID', value: a.paymentAccount?.vpa },
        { label: 'Amount', value: <Money value={a.amount} /> },
      ],
      confirmLabel: 'Cancel assignment',
      destructive: true,
    })
    if (ok) await cancel.mutateAsync({ userId })
  }

  if (!a) return null

  return (
    <Panel className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold">Payment assignment</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {pendingProof
              ? 'A payment proof is under review.'
              : `Awaiting payment of ${formatMoney(a.amount)}.`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            size="sm"
            className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-400/20 dark:text-rose-400"
            onClick={onCancel}
            disabled={!!pendingProof || cancel.isPending}
          >
            Cancel assignment
          </Button>
          {pendingProof ? (
            <p className="text-muted-foreground text-xs">
              Review the{' '}
              <button
                type="button"
                onClick={() => (pendingProof.id ? onOpenProof(pendingProof.id) : undefined)}
                className="text-brand font-semibold hover:underline"
              >
                pending proof
              </button>{' '}
              first
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <DetailList
          items={[
            { label: 'Label', value: a.paymentAccount?.label },
            { label: 'UPI ID', value: a.paymentAccount?.vpa },
            { label: 'Payee', value: a.paymentAccount?.payeeName },
            { label: 'Amount', value: <Money value={a.amount} /> },
            { label: 'Assigned', value: <DateTime value={a.assignedAt} /> },
          ]}
        />
        <div className="flex size-40 items-center justify-center rounded-2xl border bg-white p-2">
          {qr.url ? (
            <img
              src={qr.url}
              alt={`Payment QR for ${a.paymentAccount?.vpa ?? 'UPI'}`}
              className="size-full object-contain"
            />
          ) : qr.error ? (
            <p className="text-muted-foreground p-4 text-center text-xs">QR not available</p>
          ) : (
            <Skeleton className="size-full" />
          )}
        </div>
      </div>
    </Panel>
  )
}

function LedgerTab({ userId }: { userId: string }) {
  const q = useLedger(userId)
  const rows = useMemo(() => q.data?.pages.flatMap((pg) => pg.items ?? []) ?? [], [q.data])
  const columns = useMemo<ColumnDef<LedgerEntry, unknown>[]>(
    () => [
      {
        id: 'when',
        header: 'When',
        cell: ({ row }) => <DateTime value={row.original.createdAt} />,
      },
      {
        id: 'type',
        header: 'Entry',
        cell: ({ row }) => (
          <span className="font-semibold">{humanize(row.original.entryType)}</span>
        ),
      },
      { id: 'bucket', header: 'Bucket', cell: ({ row }) => humanize(row.original.bucket) },
      { id: 'source', header: 'Source', cell: ({ row }) => humanize(row.original.sourceType) },
      {
        id: 'amount',
        header: 'Amount',
        cell: ({ row }) => <Money value={row.original.amount} signed className="font-bold" />,
      },
    ],
    [],
  )
  return (
    <DataTable
      label="Ledger"
      columns={columns}
      data={rows}
      getRowId={(r) => String(r.id)}
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      error={q.error}
      onRefresh={() => void q.refetch()}
      emptyTitle="No ledger entries"
      paging={{
        mode: 'cursor',
        hasMore: !!q.hasNextPage,
        onLoadMore: () => void q.fetchNextPage(),
        loadingMore: q.isFetchingNextPage,
      }}
    />
  )
}
