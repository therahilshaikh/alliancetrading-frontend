import { useMemo } from 'react'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/data-table'
import { DateTime, Money, PlainDate } from '@/components/shared/format'
import { PageHeader } from '@/components/shared/layout'
import { StatusBadge } from '@/components/shared/status-badge'
import { humanize } from '@/lib/format'
import { useBatches, type Batch, type BatchStatus } from '../api'
import { PostPnlForm } from '../components/post-form'
import { useAdminName } from '@/features/admins/api'

const route = getRouteApi('/app/pnl')
const ALL = 'ALL'

export function PnlPage() {
  const { tab } = route.useSearch()
  const navigate = route.useNavigate()
  // Only the count is needed for the tab badge.
  const awaiting = useBatches({ status: 'DRAFT', assignedToMe: true, page: 0, size: 1 })
  const awaitingCount = awaiting.data?.totalItems ?? 0

  return (
    <>
      <PageHeader
        eyebrow="Daily ledger"
        title="Update profit or loss"
        description="Post profit or loss to all active members or to selected members. A second admin reviews the exact allocations and approves before anything posts."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => void navigate({ search: { tab: v as typeof tab }, replace: true })}
      >
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="post">Post P&L</TabsTrigger>
          <TabsTrigger value="awaiting">
            Awaiting my approval
            {awaitingCount ? (
              <span className="bg-brand ml-1.5 rounded-full px-1.5 text-[10px] font-extrabold text-white">
                {awaitingCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="post">
          <PostPnlForm />
        </TabsContent>
        <TabsContent value="awaiting">
          <AwaitingList />
        </TabsContent>
        <TabsContent value="history">
          <HistoryList />
        </TabsContent>
      </Tabs>
    </>
  )
}

function useBatchColumns(kind: 'awaiting' | 'history') {
  const adminName = useAdminName()
  return useMemo<ColumnDef<Batch, unknown>[]>(
    () => [
      {
        id: 'date',
        header: 'Session date',
        accessorFn: (b) => b.sessionDate ?? '',
        cell: ({ row }) => <PlainDate value={row.original.sessionDate} />,
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="text-sm font-semibold">
            {row.original.valueType === 'PERCENTAGE' ? '% of principal' : 'Fixed ₹'}
            {row.original.batchType === 'ADJUSTMENT' ? (
              <span className="text-muted-foreground ml-1.5 text-xs">(adjustment)</span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'total',
        header: 'Total',
        cell: ({ row }) => <Money value={row.original.controlTotal} signed className="font-bold" />,
      },
      {
        id: 'maker',
        header: 'Maker',
        cell: ({ row }) => <span className="text-sm">{adminName(row.original.makerId)}</span>,
      },
      ...(kind === 'history'
        ? [
            {
              id: 'checker',
              header: 'Approver',
              cell: ({ row }: { row: { original: Batch } }) => (
                <span className="text-sm">
                  {adminName(row.original.checkerId ?? row.original.assignedCheckerId)}
                </span>
              ),
            },
            {
              id: 'status',
              header: 'Status',
              cell: ({ row }: { row: { original: Batch } }) => (
                <StatusBadge status={row.original.status} />
              ),
            },
          ]
        : []),
      {
        id: 'created',
        header: 'Created',
        accessorFn: (b) => b.createdAt ?? '',
        cell: ({ row }) => <DateTime value={row.original.createdAt} />,
      },
      {
        id: 'open',
        header: () => <span className="sr-only">Open</span>,
        enableHiding: false,
        cell: ({ row }) =>
          row.original.id ? (
            <Button size="sm" variant={kind === 'awaiting' ? 'default' : 'outline'} asChild>
              {kind === 'awaiting' || row.original.status === 'DRAFT' ? (
                <Link to="/pnl/$batchId/preview" params={{ batchId: row.original.id }}>
                  {kind === 'awaiting' ? 'Review' : 'Preview'}
                </Link>
              ) : (
                <Link to="/pnl/$batchId/allocations" params={{ batchId: row.original.id }}>
                  Allocations
                </Link>
              )}
            </Button>
          ) : null,
      },
    ],
    [kind, adminName],
  )
}

/** Server paging props for a PageResponse; `go` writes page/size to the URL. */
function serverPaging(
  data: { page?: number; size?: number; totalItems?: number; totalPages?: number } | undefined,
  page: number,
  size: number,
  go: (s: { page: number; size?: number }) => void,
) {
  return {
    mode: 'server' as const,
    page: data?.page ?? page,
    size: data?.size ?? size,
    totalItems: data?.totalItems ?? 0,
    totalPages: data?.totalPages ?? 0,
    onPageChange: (p: number) => go({ page: p }),
    onSizeChange: (sz: number) => go({ page: 0, size: sz }),
  }
}

function AwaitingList() {
  const { page, size } = route.useSearch()
  const navigateSearch = route.useNavigate()
  const q = useBatches({ status: 'DRAFT', assignedToMe: true, page, size })
  const columns = useBatchColumns('awaiting')
  const navigate = useNavigate()
  return (
    <DataTable
      label="P&L batches awaiting my approval"
      columns={columns}
      data={q.data?.items}
      getRowId={(b) => b.id ?? ''}
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      error={q.error}
      onRefresh={() => void q.refetch()}
      onRowClick={(b) =>
        b.id && void navigate({ to: '/pnl/$batchId/preview', params: { batchId: b.id } })
      }
      emptyTitle="Nothing waiting for you"
      emptyDescription="Batches where you are the chosen approver appear here."
      paging={serverPaging(
        q.data,
        page,
        size,
        (s) => void navigateSearch({ search: (prev) => ({ ...prev, ...s }) }),
      )}
    />
  )
}

function HistoryList() {
  const { status, type, page, size } = route.useSearch()
  const navigate = route.useNavigate()
  const q = useBatches({ status, valueType: type, page, size })
  const columns = useBatchColumns('history')

  return (
    <DataTable
      label="P&L batches"
      columns={columns}
      data={q.data?.items}
      getRowId={(b) => b.id ?? ''}
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      error={q.error}
      onRefresh={() => void q.refetch()}
      emptyTitle="No batches match"
      paging={serverPaging(
        q.data,
        page,
        size,
        (s) => void navigate({ search: (prev) => ({ ...prev, ...s }) }),
      )}
      toolbar={
        <>
          <Select
            value={status ?? ALL}
            onValueChange={(v) =>
              void navigate({
                search: (s) => ({
                  ...s,
                  status: v === ALL ? undefined : (v as BatchStatus),
                  page: 0,
                }),
              })
            }
          >
            <SelectTrigger className="h-9 w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {(['DRAFT', 'APPROVED', 'REJECTED'] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {s === 'DRAFT' ? 'Awaiting approval' : humanize(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={type ?? ALL}
            onValueChange={(v) =>
              void navigate({
                search: (s) => ({
                  ...s,
                  type: v === ALL ? undefined : (v as 'FIXED' | 'PERCENTAGE'),
                  page: 0,
                }),
              })
            }
          >
            <SelectTrigger className="h-9 w-40" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              <SelectItem value="FIXED">Fixed ₹</SelectItem>
              <SelectItem value="PERCENTAGE">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    />
  )
}
