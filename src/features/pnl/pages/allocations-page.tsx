import { useMemo } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/data-table'
import { Money, PlainDate } from '@/components/shared/format'
import { DetailList, PageHeader, Panel } from '@/components/shared/layout'
import { StatusBadge } from '@/components/shared/status-badge'
import { useAllocations, useBatch, type Allocation } from '../api'
import { MemberName } from '@/features/members/member-name'
import { useAdminName } from '@/features/admins/api'

const route = getRouteApi('/app/pnl/$batchId/allocations')

export function PnlAllocationsPage() {
  const { batchId } = route.useParams()
  const q = useAllocations(batchId)
  const batchQ = useBatch(batchId)
  const adminName = useAdminName()
  const batch = batchQ.data

  const columns = useMemo<ColumnDef<Allocation, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Member',
        accessorFn: (a) => a.fullName ?? a.mobile ?? '',
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
        accessorFn: (a) => a.amount ?? 0,
        cell: ({ row }) => <Money value={row.original.amount} signed className="font-bold" />,
      },
    ],
    [],
  )

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link to="/pnl" search={{ tab: 'history' }}>
          <ArrowLeft className="size-4" /> Profit & loss
        </Link>
      </Button>
      <PageHeader
        eyebrow="Allocations"
        title={batch?.sessionDate ? `P&L for ${batch.sessionDate}` : 'Batch allocations'}
      />
      {batch ? (
        <Panel className="mb-6 p-5">
          <DetailList
            items={[
              { label: 'Session date', value: <PlainDate value={batch.sessionDate} /> },
              {
                label: 'Type',
                value:
                  batch.valueType === 'PERCENTAGE' ? '% of principal' : 'Fixed amount per member',
              },
              { label: 'Total', value: <Money value={batch.controlTotal} signed /> },
              { label: 'Status', value: <StatusBadge status={batch.status} /> },
              { label: 'Maker', value: adminName(batch.makerId) },
              { label: 'Approved by', value: adminName(batch.checkerId) },
            ]}
          />
        </Panel>
      ) : null}
      <DataTable
        label="Allocations"
        columns={columns}
        data={q.data}
        getRowId={(a) => a.investmentId ?? ''}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        onRefresh={() => void q.refetch()}
        emptyTitle="No allocations"
        emptyDescription="Allocations exist only for approved batches."
        paging={{ mode: 'client', pageSize: 50 }}
      />
    </>
  )
}
