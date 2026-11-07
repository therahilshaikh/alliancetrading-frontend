import { useMemo } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/data-table'
import { DateTime, Money } from '@/components/shared/format'
import { PageHeader } from '@/components/shared/layout'
import { StatusBadge } from '@/components/shared/status-badge'
import { MemberName } from '@/features/members/member-name'
import { MULTI_INVESTMENT_ENABLED } from '@/lib/flags'
import { InvestmentSheet } from '../components/investment-sheet'
import { useInvestment, useInvestments, type Investment, type InvestmentStatus } from '../api'

const route = getRouteApi('/app/payments')

const TABS: { value: InvestmentStatus; label: string }[] = [
  { value: 'PENDING_VERIFICATION', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Closed' },
]

export function PaymentsPage() {
  const { status, page, size, id } = route.useSearch()
  const navigate = route.useNavigate()
  const query = useInvestments({ status, page, size })
  const detail = useInvestment(id)

  const columns = useMemo<ColumnDef<Investment, unknown>[]>(
    () => [
      {
        id: 'member',
        header: 'Member',
        accessorFn: (i) => i.fullName ?? i.mobile ?? '',
        cell: ({ row }) => (
          <MemberName
            userId={row.original.userId}
            fullName={row.original.fullName}
            mobile={row.original.mobile}
          />
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        accessorFn: (r) => r.amount ?? 0,
        cell: ({ row }) => <Money value={row.original.amount} className="font-bold" />,
      },
      // Tranche-aware column; hidden until multi-investment ships (VITE_MULTI_INVESTMENT_ENABLED).
      ...(MULTI_INVESTMENT_ENABLED
        ? [
            {
              id: 'remainingPrincipal',
              header: 'Remaining',
              cell: ({ row }) => <Money value={row.original.remainingPrincipal} />,
            } satisfies ColumnDef<Investment, unknown>,
          ]
        : []),
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'createdAt',
        header: 'Submitted',
        accessorFn: (r) => r.createdAt ?? '',
        cell: ({ row }) => <DateTime value={row.original.createdAt} />,
      },
    ],
    [],
  )

  // Row from the loaded page shows instantly; the by-id fetch covers deep links to other pages.
  const selected = id ? (detail.data ?? query.data?.items?.find((i) => i.id === id)) : undefined

  return (
    <>
      <PageHeader
        title="Payment proofs"
        description="Check each UPI payment proof, then approve to post the deposit or reject with a reason."
      />
      <DataTable
        label="Investments"
        columns={columns}
        data={query.data?.items}
        getRowId={(r) => r.id ?? ''}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRefresh={() => void query.refetch()}
        onRowClick={(r) => void navigate({ search: (s) => ({ ...s, id: r.id }) })}
        emptyTitle={
          status === 'PENDING_VERIFICATION' ? 'No payment proofs waiting' : 'No investments'
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
        toolbar={
          <Tabs
            value={status}
            onValueChange={(v) =>
              void navigate({
                search: (s) => ({ status: v as InvestmentStatus, page: 0, size: s.size }),
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
      <InvestmentSheet
        key={selected?.id}
        investment={selected}
        onClose={() => void navigate({ search: (s) => ({ ...s, id: undefined }) })}
      />
    </>
  )
}
