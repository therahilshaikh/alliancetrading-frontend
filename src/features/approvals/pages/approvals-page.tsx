import { useMemo } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/data-table'
import { DateTime } from '@/components/shared/format'
import { PageHeader } from '@/components/shared/layout'
import { StatusBadge, WarningBadge } from '@/components/shared/status-badge'
import { namesMatch } from '@/lib/validation'
import { useKycQueue, type KycQueueItem, type MemberStatus } from '../api'
import { MemberName } from '@/features/members/member-name'
import { KycSheet } from '../components/kyc-sheet'

const route = getRouteApi('/app/approvals')

type ApprovalTab = Extract<MemberStatus, 'KYC_SUBMITTED' | 'APPROVED' | 'REJECTED'>

const TABS: { value: ApprovalTab; label: string }[] = [
  { value: 'KYC_SUBMITTED', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

export function ApprovalsPage() {
  const { status, page, size, userId } = route.useSearch()
  const navigate = route.useNavigate()
  const query = useKycQueue(status, page, size)
  const items = query.data?.items

  const columns = useMemo<ColumnDef<KycQueueItem, unknown>[]>(
    () => [
      {
        id: 'member',
        header: 'Member',
        cell: ({ row }) => (
          <MemberName
            userId={row.original.userId}
            fullName={row.original.fullName}
            mobile={row.original.mobile}
            link={false}
          />
        ),
      },
      {
        id: 'pan',
        header: 'PAN',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.panMasked ?? '—'}</span>
        ),
      },
      {
        id: 'bank',
        header: 'Bank',
        cell: ({ row }) => {
          const bank = row.original.bankAccount
          if (!bank) return <span className="text-muted-foreground">—</span>
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs">{bank.accountNumberMasked}</span>
              {!namesMatch(row.original.fullName, bank.holderName) ? (
                <WarningBadge>
                  <AlertTriangle className="size-3" aria-hidden /> Name differs
                </WarningBadge>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'submitted',
        header: 'Submitted',
        cell: ({ row }) => <DateTime value={row.original.submittedAt} />,
      },
    ],
    [],
  )

  const selected = items?.find((m) => m.userId === userId)

  return (
    <>
      <PageHeader
        title="Account approvals"
        description="Review KYC and bank details, then approve with a payment assignment or reject with a reason."
      />
      <DataTable
        label="KYC queue"
        columns={columns}
        data={items}
        getRowId={(r) => r.userId ?? ''}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRefresh={() => void query.refetch()}
        onRowClick={(r) => void navigate({ search: (s) => ({ ...s, userId: r.userId }) })}
        emptyTitle={status === 'KYC_SUBMITTED' ? 'No accounts waiting for review' : 'No accounts'}
        toolbar={
          <Tabs
            value={status}
            onValueChange={(v) =>
              void navigate({ search: { status: v as ApprovalTab, page: 0, size } })
            }
          >
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
        paging={{
          mode: 'server',
          page: query.data?.page ?? page,
          size: query.data?.size ?? size,
          totalItems: query.data?.totalItems ?? 0,
          totalPages: query.data?.totalPages ?? 0,
          onPageChange: (p) => void navigate({ search: (s) => ({ ...s, page: p }) }),
          onSizeChange: (sz) => void navigate({ search: (s) => ({ ...s, size: sz, page: 0 }) }),
        }}
      />
      <KycSheet
        member={selected}
        onClose={() => void navigate({ search: (s) => ({ ...s, userId: undefined }) })}
      />
    </>
  )
}
