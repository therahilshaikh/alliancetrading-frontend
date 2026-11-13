import { useMemo } from 'react'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, ArrowLeft, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfirm } from '@/components/shared/confirm'
import { DataTable } from '@/components/shared/data-table'
import { DateTime, Money, PlainDate } from '@/components/shared/format'
import { DetailList, ErrorState, PageHeader, Panel } from '@/components/shared/layout'
import { StatusBadge } from '@/components/shared/status-badge'
import { useAuth } from '@/app/auth'
import { MemberName } from '@/features/members/member-name'
import { useApproveBatch, useBatch, usePreview, useRejectBatch, type Preview } from '../api'
import { LargeChangeBadge, LargeChangeSummary } from '../components/large-change'
import { TrancheBreakdown } from '../components/tranches'
import { useAdminName } from '@/features/admins/api'

const route = getRouteApi('/app/pnl/$batchId/preview')
type Row = NonNullable<Preview['allocations']>[number]

/**
 * The approver must review this preview before approving, so Approve/Reject
 * live only on this page (doc §6.4).
 */
export function PnlPreviewPage() {
  const { batchId } = route.useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { adminId } = useAuth()
  const adminName = useAdminName()
  const preview = usePreview(batchId)
  const batchQ = useBatch(batchId)
  const approve = useApproveBatch()
  const reject = useRejectBatch()

  const batch = batchQ.data
  const p = preview.data
  const isMine = !!batch && batch.assignedCheckerId === adminId
  const canDecide = batch?.status === 'DRAFT' && isMine
  const warnings = p?.warnings ?? []
  const threshold = p?.largeChangeThresholdPct

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: 'member',
        header: 'Member',
        accessorFn: (r) => r.fullName ?? '',
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
        header: 'P&L',
        accessorFn: (r) => r.amount ?? 0,
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-2">
            <Money value={row.original.amount} signed className="font-bold" />
            {row.original.largeChange ? <LargeChangeBadge threshold={threshold} /> : null}
          </span>
        ),
      },
      {
        id: 'principal',
        header: 'Principal',
        cell: ({ row }) => <Money value={row.original.principal} />,
      },
      {
        id: 'profit',
        header: 'Profit now',
        cell: ({ row }) => <Money value={row.original.profit} signed />,
      },
      {
        id: 'resultingPrincipal',
        header: 'Principal after',
        cell: ({ row }) => <Money value={row.original.resultingPrincipal} />,
      },
      {
        id: 'resultingProfit',
        header: 'Profit after',
        cell: ({ row }) => <Money value={row.original.resultingProfit} signed />,
      },
      {
        id: 'tranches',
        header: 'Investments',
        enableSorting: false,
        cell: ({ row }) => <TrancheBreakdown tranches={row.original.tranches} />,
      },
    ],
    [threshold],
  )

  async function onApprove() {
    if (!p) return
    const ok = await confirm({
      title: 'Approve and post this P&L?',
      description:
        'Amounts are posted to every listed member’s ledger. This can’t be undone; corrections need an adjustment batch.',
      details: [
        { label: 'Session date', value: <PlainDate value={p.sessionDate} /> },
        {
          label: 'Type',
          value: p.valueType === 'PERCENTAGE' ? '% of principal' : 'Fixed amount per member',
        },
        { label: 'Total', value: <Money value={p.controlTotal} signed /> },
        { label: 'Members', value: p.allocations?.length ?? 0 },
        ...(warnings.length ? [{ label: 'Warnings', value: `${warnings.length} — reviewed` }] : []),
      ],
      confirmLabel: 'Approve and post',
    })
    if (!ok) return
    await approve.mutateAsync(batchId)
    void navigate({ to: '/pnl/$batchId/allocations', params: { batchId } })
  }

  async function onReject() {
    const res = await confirm({
      title: 'Reject this batch?',
      description: 'Nothing is posted. The maker can create a corrected batch.',
      details: [
        { label: 'Session date', value: <PlainDate value={p?.sessionDate} /> },
        { label: 'Total', value: <Money value={p?.controlTotal} signed /> },
      ],
      reason: { label: 'Reason for the maker', required: true, minLength: 3 },
      confirmLabel: 'Reject batch',
      destructive: true,
    })
    if (!res?.reason) return
    await reject.mutateAsync({ id: batchId, reason: res.reason })
    void navigate({ to: '/pnl', search: { tab: 'awaiting' } })
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link to="/pnl" search={{ tab: 'awaiting' }}>
          <ArrowLeft className="size-4" /> Profit & loss
        </Link>
      </Button>
      <PageHeader
        eyebrow="Preview"
        title={p?.sessionDate ? `P&L for ${p.sessionDate}` : 'P&L preview'}
        description="Check every member’s amount and resulting balance before approving."
        actions={
          canDecide ? (
            <>
              <Button
                variant="outline"
                className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-400/20 dark:text-rose-400"
                onClick={onReject}
                disabled={reject.isPending || approve.isPending}
              >
                <X className="size-4" /> Reject
              </Button>
              <Button onClick={onApprove} disabled={!p || approve.isPending || reject.isPending}>
                <Check className="size-4" /> Approve
              </Button>
            </>
          ) : null
        }
      />

      {preview.error ? (
        <Panel>
          <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
        </Panel>
      ) : !p ? (
        <Skeleton className="h-80 w-full rounded-3xl" />
      ) : (
        <div className="space-y-6">
          {batch && !isMine && batch.status === 'DRAFT' ? (
            <p className="rounded-2xl bg-slate-100 p-4 text-sm dark:bg-white/5">
              Only the assigned approver ({adminName(batch.assignedCheckerId)}) can approve or
              reject this batch.
            </p>
          ) : null}

          {warnings.length ? (
            <section
              role="alert"
              className="rounded-3xl border border-amber-300 bg-amber-50 p-5 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
            >
              <p className="flex items-center gap-2 font-extrabold">
                <AlertTriangle className="size-5" aria-hidden /> {warnings.length} warning
                {warnings.length > 1 ? 's' : ''} to review
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              {p.valueType === 'PERCENTAGE' ? (
                <p className="mt-2 text-xs">
                  If active investments changed since creation, approval is refused. Reject this
                  batch and post a new one.
                </p>
              ) : null}
            </section>
          ) : null}

          <LargeChangeSummary
            count={(p.allocations ?? []).filter((a) => a.largeChange).length}
            threshold={p.largeChangeThresholdPct}
          />

          <Panel className="p-5">
            <DetailList
              items={[
                { label: 'Session date', value: <PlainDate value={p.sessionDate} /> },
                {
                  label: 'Type',
                  value:
                    p.valueType === 'PERCENTAGE' ? '% of principal' : 'Fixed amount per member',
                },
                { label: 'Total', value: <Money value={p.controlTotal} signed /> },
                { label: 'Members', value: p.allocations?.length ?? 0 },
                { label: 'Maker', value: adminName(batch?.makerId) },
                { label: 'Approver', value: adminName(batch?.assignedCheckerId) },
                { label: 'Status', value: <StatusBadge status={batch?.status} /> },
                { label: 'Created', value: <DateTime value={batch?.createdAt} /> },
              ]}
            />
            {batch?.notes ? (
              <p className="bg-muted/60 mt-4 rounded-2xl p-3 text-sm whitespace-pre-wrap">
                {batch.notes}
              </p>
            ) : null}
          </Panel>

          <DataTable
            label="Allocations preview"
            columns={columns}
            data={p.allocations}
            getRowId={(r) => r.userId ?? ''}
            isFetching={preview.isFetching}
            onRefresh={() => void preview.refetch()}
            emptyTitle="No members affected"
            paging={{ mode: 'client', pageSize: 50 }}
          />
        </div>
      )}
    </>
  )
}
