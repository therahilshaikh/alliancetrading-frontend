import { useMemo, useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { BadgeCheck, Check, Info, Loader2, OctagonX, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfirm } from '@/components/shared/confirm'
import { DataTable } from '@/components/shared/data-table'
import { DocumentUpload } from '@/components/shared/document-upload'
import { DocumentViewer } from '@/components/shared/document-viewer'
import { DateTime, Money } from '@/components/shared/format'
import { DetailList, PageHeader } from '@/components/shared/layout'
import { PayoutReceipt } from '../components/payout-receipt'
import { PiiReveal } from '@/components/shared/pii-reveal'
import { StatusBadge, WarningBadge } from '@/components/shared/status-badge'
import { useAuth } from '@/app/auth'
import { revealAccountNumber } from '@/features/bank-accounts/api'
import { useAdminName } from '@/features/admins/api'
import { humanize } from '@/lib/format'
import { MemberName } from '@/features/members/member-name'
import {
  useApproveWithdrawal,
  useMarkFailed,
  useMarkPaid,
  useRejectWithdrawal,
  useSecondApproveWithdrawal,
  useWithdrawal,
  useWithdrawals,
  type Withdrawal,
  type WithdrawalStatus,
} from '../api'

const route = getRouteApi('/app/withdrawals')
const UTR = /^[A-Za-z0-9]{12,22}$/

const TABS: { value: WithdrawalStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PAID', label: 'Paid' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PAYOUT_FAILED', label: 'Payout failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export function WithdrawalsPage() {
  const { status, page, size, id } = route.useSearch()
  const navigate = route.useNavigate()
  const q = useWithdrawals({ status: status === 'ALL' ? undefined : status, page, size })
  const detail = useWithdrawal(id)

  const columns = useMemo<ColumnDef<Withdrawal, unknown>[]>(
    () => [
      {
        id: 'member',
        header: 'Member',
        accessorFn: (w) => w.fullName ?? w.mobile ?? '',
        cell: ({ row }) => (
          <MemberName
            userId={row.original.userId}
            fullName={row.original.fullName}
            mobile={row.original.mobile}
          />
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="font-semibold">{humanize(row.original.withdrawalType)}</span>
        ),
      },
      {
        id: 'gross',
        header: 'Requested',
        accessorFn: (w) => w.grossAmount ?? 0,
        cell: ({ row }) => <Money value={row.original.grossAmount} />,
      },
      { id: 'fee', header: 'Fee', cell: ({ row }) => <Money value={row.original.feeAmount} /> },
      {
        id: 'net',
        header: 'Payout',
        accessorFn: (w) => w.netAmount ?? 0,
        cell: ({ row }) => <Money value={row.original.netAmount} className="font-bold" />,
      },
      {
        id: 'bank',
        header: 'Bank',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.bankAccountMasked ?? '—'}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <StatusBadge status={row.original.status} />
            {row.original.awaitingSecondApproval ? (
              <WarningBadge>Needs 2nd approval</WarningBadge>
            ) : null}
          </div>
        ),
      },
      {
        id: 'created',
        header: 'Requested at',
        accessorFn: (w) => w.createdAt ?? '',
        cell: ({ row }) => <DateTime value={row.original.createdAt} />,
      },
    ],
    [],
  )

  // Row from the loaded page shows instantly; the by-id fetch covers deep links to other pages.
  const selected = id ? (detail.data ?? q.data?.items?.find((w) => w.id === id)) : undefined

  return (
    <>
      <PageHeader
        title="Withdrawals"
        description="Approve, then mark paid after sending the payout. Large withdrawals need a second approval from a different admin before payout."
      />
      <DataTable
        label="Withdrawals"
        columns={columns}
        data={q.data?.items}
        getRowId={(w) => w.id ?? ''}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        onRefresh={() => void q.refetch()}
        onRowClick={(w) => void navigate({ search: (s) => ({ ...s, id: w.id }) })}
        emptyTitle={
          status === 'ALL'
            ? 'No withdrawals'
            : `No ${TABS.find((t) => t.value === status)?.label.toLowerCase()} withdrawals`
        }
        paging={{
          mode: 'server',
          page: q.data?.page ?? page,
          size: q.data?.size ?? size,
          totalItems: q.data?.totalItems ?? 0,
          totalPages: q.data?.totalPages ?? 0,
          onPageChange: (p) => void navigate({ search: (s) => ({ ...s, page: p }) }),
          onSizeChange: (sz) => void navigate({ search: (s) => ({ ...s, size: sz, page: 0 }) }),
        }}
        toolbar={
          <Tabs
            value={status}
            onValueChange={(v) =>
              void navigate({
                search: (s) => ({ status: v as WithdrawalStatus | 'ALL', page: 0, size: s.size }),
              })
            }
          >
            <TabsList className="flex-wrap">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />
      <WithdrawalSheet
        key={selected?.id}
        withdrawal={selected}
        onClose={() => void navigate({ search: (s) => ({ ...s, id: undefined }) })}
      />
    </>
  )
}

function WithdrawalSheet({
  withdrawal: w,
  onClose,
}: {
  withdrawal: Withdrawal | undefined
  onClose: () => void
}) {
  const confirm = useConfirm()
  const { adminId } = useAuth()
  const adminName = useAdminName()
  const approve = useApproveWithdrawal()
  const secondApprove = useSecondApproveWithdrawal()
  const reject = useRejectWithdrawal()
  const markFailed = useMarkFailed()
  const [paidOpen, setPaidOpen] = useState(false)
  const busy =
    approve.isPending || secondApprove.isPending || reject.isPending || markFailed.isPending

  if (!w?.id) return <Sheet open={false} />
  const id = w.id
  const bankAccountId = w.bankAccountId

  const facts = [
    { label: 'Member', value: w.fullName },
    { label: 'Type', value: humanize(w.withdrawalType) },
  ]
  const receipt = <PayoutReceipt withdrawal={w} showPayTo />

  async function run(kind: 'approve' | 'second' | 'reject' | 'failed') {
    if (kind === 'approve') {
      const ok = await confirm({
        title:
          w?.status === 'PAYOUT_FAILED' ? 'Approve this payout again?' : 'Approve this withdrawal?',
        description: w?.secondApprovalRequired
          ? 'This amount is at or above the threshold, so a different admin must give a second approval before payout.'
          : 'Next, send the payout and mark it paid.',
        details: facts,
        summary: receipt,
        confirmLabel: 'Approve',
      })
      if (ok) await approve.mutateAsync(id)
    } else if (kind === 'second') {
      const ok = await confirm({
        title: 'Give second approval?',
        description: 'After this the payout can be sent and marked paid.',
        details: facts,
        summary: receipt,
        confirmLabel: 'Second-approve',
      })
      if (ok) await secondApprove.mutateAsync(id)
    } else if (kind === 'reject') {
      const res = await confirm({
        title: 'Reject this withdrawal?',
        description: 'Held funds are released back to the member, who sees this reason.',
        details: facts,
        summary: receipt,
        reason: { label: 'Reason shown to the member', required: true, minLength: 5 },
        confirmLabel: 'Reject',
        destructive: true,
      })
      if (res?.reason) {
        await reject.mutateAsync({ id, reason: res.reason })
        onClose()
      }
    } else {
      const res = await confirm({
        title: 'Mark payout as failed?',
        description:
          'Use this when the bank transfer bounced or couldn’t be sent. You can approve it again or reject it afterwards.',
        details: facts,
        summary: receipt,
        reason: { label: 'Failure reason', required: true, minLength: 5 },
        confirmLabel: 'Mark failed',
        destructive: true,
      })
      if (res?.reason) {
        await markFailed.mutateAsync({ id, failureReason: res.reason })
        onClose()
      }
    }
  }

  const canApprove = w.status === 'REQUESTED' || w.status === 'PAYOUT_FAILED'
  const isApproved = w.status === 'APPROVED'
  const awaitingSecond = isApproved && !!w.awaitingSecondApproval
  const iApproved = !!adminId && w.approvedBy === adminId

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-xl font-extrabold">
              <Money value={w.netAmount} />
            </SheetTitle>
            <StatusBadge status={w.status} />
            {awaitingSecond ? <WarningBadge>Needs 2nd approval</WarningBadge> : null}
          </div>
          <SheetDescription>
            {humanize(w.withdrawalType)} withdrawal for{' '}
            {w.userId ? (
              <Link
                to="/members/$userId"
                params={{ userId: w.userId }}
                className="text-brand font-semibold hover:underline"
              >
                {w.fullName ?? 'member'}
              </Link>
            ) : (
              (w.fullName ?? 'member')
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4">
          <DetailList
            items={[
              { label: 'Member', value: w.fullName },
              { label: 'Mobile', value: <span className="font-mono">{w.mobile}</span> },
              { label: 'Type', value: humanize(w.withdrawalType) },
            ]}
          />

          <section aria-labelledby="payout-to-h" className="space-y-2">
            <h3
              id="payout-to-h"
              className="text-muted-foreground text-xs font-extrabold tracking-wider uppercase"
            >
              Pay to
            </h3>
            <DetailList
              items={[
                { label: 'Account holder', value: w.bankHolderName },
                {
                  label: 'Account number',
                  value: bankAccountId ? (
                    <PiiReveal
                      masked={w.bankAccountMasked}
                      label="account number"
                      fetchValue={() => revealAccountNumber(bankAccountId)}
                    />
                  ) : (
                    w.bankAccountMasked
                  ),
                },
                { label: 'IFSC', value: <span className="font-mono">{w.bankIfsc}</span> },
                { label: 'UPI ID', value: w.bankVpa },
              ]}
            />
          </section>

          <PayoutReceipt withdrawal={w} />

          {awaitingSecond ? (
            <p className="flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                This amount is at or above the second-approval threshold. A different admin from{' '}
                {adminName(w.approvedBy)} must approve it before it can be marked paid.
              </span>
            </p>
          ) : null}

          <section aria-labelledby="timeline-h">
            <h3
              id="timeline-h"
              className="text-muted-foreground mb-2 text-xs font-extrabold tracking-wider uppercase"
            >
              Timeline
            </h3>
            <ol className="space-y-2 border-l-2 border-slate-200 pl-4 text-sm dark:border-white/10">
              <li>
                Requested · <DateTime value={w.createdAt} />
              </li>
              {w.approvedBy ? <li>Approved by {adminName(w.approvedBy)}</li> : null}
              {w.secondApprovedBy ? (
                <li>Second approval by {adminName(w.secondApprovedBy)}</li>
              ) : null}
              {w.paidAt ? (
                <li>
                  Paid · <DateTime value={w.paidAt} />
                  {w.paidBy ? ` · by ${adminName(w.paidBy)}` : ''}
                  {w.payoutUtr ? (
                    <>
                      {' '}
                      · UTR <span className="font-mono">{w.payoutUtr}</span>
                    </>
                  ) : null}
                </li>
              ) : null}
              {w.status === 'REJECTED' ? (
                <li className="text-rose-700 dark:text-rose-400">
                  Rejected{w.rejectionReason ? `: ${w.rejectionReason}` : ''}
                </li>
              ) : null}
              {w.status === 'PAYOUT_FAILED' ? (
                <li className="text-rose-700 dark:text-rose-400">
                  Payout failed{w.failureReason ? `: ${w.failureReason}` : ''}
                </li>
              ) : null}
              {w.status === 'CANCELLED' ? <li>Cancelled by the member</li> : null}
              {w.updatedAt ? (
                <li className="text-muted-foreground">
                  Last updated · <DateTime value={w.updatedAt} />
                </li>
              ) : null}
            </ol>
          </section>

          {w.payoutProofDocumentId ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-extrabold tracking-wider uppercase">
                Payout proof
              </p>
              <DocumentViewer documentId={w.payoutProofDocumentId} title="Payout proof" />
            </div>
          ) : null}
        </div>
        {canApprove || isApproved ? (
          <SheetFooter className="grid grid-cols-2 gap-2 border-t">
            {canApprove ? (
              <>
                <Button
                  variant="outline"
                  className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-400/20 dark:text-rose-400"
                  disabled={busy}
                  onClick={() => void run('reject')}
                >
                  <X className="size-4" /> Reject
                </Button>
                <Button disabled={busy} onClick={() => void run('approve')}>
                  <Check className="size-4" /> Approve
                </Button>
              </>
            ) : awaitingSecond ? (
              <>
                <Button
                  className="col-span-2"
                  disabled={busy || iApproved}
                  onClick={() => void run('second')}
                >
                  <BadgeCheck className="size-4" /> Second-approve
                </Button>
                {iApproved ? (
                  <p className="text-muted-foreground col-span-2 text-center text-xs">
                    You gave the first approval, so another admin must do this.
                  </p>
                ) : null}
                <Button
                  variant="ghost"
                  className="col-span-2 text-rose-700 dark:text-rose-400"
                  disabled={busy}
                  onClick={() => void run('failed')}
                >
                  <OctagonX className="size-4" /> Mark payout failed
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="text-rose-700 dark:text-rose-400"
                  disabled={busy}
                  onClick={() => void run('failed')}
                >
                  <OctagonX className="size-4" /> Mark failed
                </Button>
                <Button disabled={busy} onClick={() => setPaidOpen(true)}>
                  <Send className="size-4" /> Mark paid
                </Button>
              </>
            )}
          </SheetFooter>
        ) : null}
        <MarkPaidDialog
          withdrawal={w}
          open={paidOpen}
          onOpenChange={setPaidOpen}
          onDone={onClose}
        />
      </SheetContent>
    </Sheet>
  )
}

function MarkPaidDialog({
  withdrawal: w,
  open,
  onOpenChange,
  onDone,
}: {
  withdrawal: Withdrawal
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const markPaid = useMarkPaid()
  const [utr, setUtr] = useState('')
  const [proofId, setProofId] = useState<string | undefined>()
  const [uploading, setUploading] = useState(false)
  const trimmed = utr.trim()
  const invalid = trimmed.length > 0 && !UTR.test(trimmed)

  async function submit() {
    if (!w.id || invalid) return
    await markPaid.mutateAsync({
      id: w.id,
      payoutUtr: trimmed || undefined,
      payoutProofDocumentId: proofId,
    })
    onOpenChange(false)
    onDone()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Mark as paid?</DialogTitle>
          <DialogDescription>
            Confirm you have sent <Money value={w.netAmount} className="font-bold" /> to{' '}
            {w.bankHolderName ?? 'the member'} ({w.bankAccountMasked ?? 'bank account'},{' '}
            {w.bankIfsc}). This posts the payout and fee to the ledger.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="utr">Bank UTR / reference (optional)</Label>
            <Input
              id="utr"
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/\s/g, ''))}
              maxLength={22}
              placeholder="12–22 letters or digits"
              aria-invalid={invalid}
              aria-describedby="utr-help"
              className="font-mono"
              autoComplete="off"
            />
            <p
              id="utr-help"
              className={invalid ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}
            >
              {invalid
                ? 'UTR must be 12–22 letters or digits.'
                : 'Recommended, so the payout can be traced.'}
            </p>
          </div>
          {w.userId ? (
            <div className="space-y-2">
              <Label htmlFor="payout-proof">Payout proof (optional)</Label>
              <DocumentUpload
                id="payout-proof"
                docType="PAYOUT_PROOF"
                ownerUserId={w.userId}
                value={proofId}
                onChange={setProofId}
                onBusyChange={setUploading}
                disabled={markPaid.isPending}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={invalid || uploading || markPaid.isPending}
          >
            {markPaid.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Mark paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
