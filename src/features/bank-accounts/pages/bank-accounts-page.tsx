import { useMemo } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Check, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { DocumentViewer } from '@/components/shared/document-viewer'
import { DateTime } from '@/components/shared/format'
import { DetailList, PageHeader } from '@/components/shared/layout'
import { PiiReveal } from '@/components/shared/pii-reveal'
import { StatusBadge } from '@/components/shared/status-badge'
import { MemberName } from '@/features/members/member-name'
import { humanize } from '@/lib/format'
import {
  revealAccountNumber,
  useBankAccount,
  useBankAccounts,
  useRejectBank,
  useVerifyBank,
  type BankAccount,
  type BankStatus,
} from '../api'

const route = getRouteApi('/app/bank-accounts')

const TABS: { value: BankStatus; label: string }[] = [
  { value: 'PENDING_VERIFICATION', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'REPLACED', label: 'Replaced' },
]

export function BankAccountsPage() {
  const { status, page, size, id } = route.useSearch()
  const navigate = route.useNavigate()
  const q = useBankAccounts({ status, page, size })
  const detail = useBankAccount(id)

  const columns = useMemo<ColumnDef<BankAccount, unknown>[]>(
    () => [
      {
        id: 'member',
        header: 'Member',
        accessorFn: (b) => b.fullName ?? b.mobile ?? '',
        cell: ({ row }) => (
          <MemberName
            userId={row.original.userId}
            fullName={row.original.fullName}
            mobile={row.original.mobile}
          />
        ),
      },
      {
        id: 'holder',
        header: 'Holder',
        accessorFn: (b) => b.holderName ?? '',
        cell: ({ row }) => <span className="font-bold">{row.original.holderName ?? '—'}</span>,
      },
      {
        id: 'account',
        header: 'Account',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.accountNumberMasked}</span>
        ),
      },
      {
        id: 'ifsc',
        header: 'IFSC',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.ifsc}</span>,
      },
      { id: 'type', header: 'Type', cell: ({ row }) => humanize(row.original.accountType) },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'created',
        header: 'Added',
        accessorFn: (b) => b.createdAt ?? '',
        cell: ({ row }) => <DateTime value={row.original.createdAt} />,
      },
    ],
    [],
  )

  // Row from the loaded page shows instantly; the by-id fetch covers deep links to other pages.
  const selected = id ? (detail.data ?? q.data?.items?.find((b) => b.id === id)) : undefined

  return (
    <>
      <PageHeader
        title="Bank accounts"
        description="Verify new and changed bank accounts. A bank change creates a new pending account; the old one keeps paying out until it is verified."
      />
      <DataTable
        label="Bank accounts"
        columns={columns}
        data={q.data?.items}
        getRowId={(b) => b.id ?? ''}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        onRefresh={() => void q.refetch()}
        onRowClick={(b) => void navigate({ search: (s) => ({ ...s, id: b.id }) })}
        emptyTitle={
          status === 'PENDING_VERIFICATION' ? 'No bank accounts to verify' : 'No bank accounts'
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
              void navigate({ search: (s) => ({ status: v as BankStatus, page: 0, size: s.size }) })
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
      <BankSheet
        key={selected?.id}
        bank={selected}
        onClose={() => void navigate({ search: (s) => ({ ...s, id: undefined }) })}
      />
    </>
  )
}

function BankSheet({ bank, onClose }: { bank: BankAccount | undefined; onClose: () => void }) {
  const confirm = useConfirm()
  const verify = useVerifyBank()
  const reject = useRejectBank()
  if (!bank?.id) return <Sheet open={false} />
  const id = bank.id
  const pending = bank.status === 'PENDING_VERIFICATION'
  const facts = [
    { label: 'Holder', value: bank.holderName },
    { label: 'Account', value: bank.accountNumberMasked },
    { label: 'IFSC', value: bank.ifsc },
  ]

  async function onVerify() {
    const ok = await confirm({
      title: 'Verify this bank account?',
      description:
        'Future payouts go to this account. If it replaces an older one, the old account is retired.',
      details: facts,
      confirmLabel: 'Verify',
    })
    if (ok) {
      await verify.mutateAsync(id)
      onClose()
    }
  }

  async function onReject() {
    const res = await confirm({
      title: 'Reject this bank account?',
      description: 'The member sees the reason. Any previous verified account keeps paying out.',
      details: facts,
      reason: { label: 'Reason shown to the member', required: true, minLength: 5 },
      confirmLabel: 'Reject',
      destructive: true,
    })
    if (res?.reason) {
      await reject.mutateAsync({ id, reason: res.reason })
      onClose()
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-xl font-extrabold">
              {bank.holderName ?? 'Bank account'}
            </SheetTitle>
            <StatusBadge status={bank.status} />
          </div>
          <SheetDescription>
            Added <DateTime value={bank.createdAt} />
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4">
          <DetailList
            items={[
              {
                label: 'Member',
                value: (
                  <MemberName userId={bank.userId} fullName={bank.fullName} mobile={bank.mobile} />
                ),
              },
              { label: 'Holder name', value: bank.holderName },
              {
                label: 'Account number',
                value: (
                  <PiiReveal
                    masked={bank.accountNumberMasked}
                    label="account number"
                    fetchValue={() => revealAccountNumber(id)}
                  />
                ),
              },
              { label: 'IFSC', value: <span className="font-mono">{bank.ifsc}</span> },
              { label: 'Type', value: humanize(bank.accountType) },
              { label: 'UPI ID', value: bank.vpa },
            ]}
          />
          {bank.cooloffUntil ? (
            <p className="flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Bank change cooling-off: the member can’t withdraw until{' '}
                <DateTime value={bank.cooloffUntil} />. Their previous verified account keeps
                receiving payouts until this one is verified.
              </span>
            </p>
          ) : null}
          {bank.rejectionReason ? (
            <p className="text-sm text-rose-700 dark:text-rose-400">
              Rejected: {bank.rejectionReason}
            </p>
          ) : null}
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-extrabold tracking-wider uppercase">
              Bank proof
            </p>
            <DocumentViewer documentId={bank.proofDocumentId} title="Bank proof" />
          </div>
        </div>
        {pending ? (
          <SheetFooter className="grid grid-cols-2 gap-2 border-t">
            <Button
              variant="outline"
              className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-400/20 dark:text-rose-400"
              onClick={() => void onReject()}
              disabled={reject.isPending || verify.isPending}
            >
              <X className="size-4" /> Reject
            </Button>
            <Button onClick={() => void onVerify()} disabled={reject.isPending || verify.isPending}>
              <Check className="size-4" /> Verify
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
