import { useMemo, useState, type FormEvent } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { DateTime } from '@/components/shared/format'
import { PageHeader } from '@/components/shared/layout'
import { apiClient } from '@/api/client'
import { unwrap } from '@/api/http'
import type { components } from '@/api/schema'
import { humanize } from '@/lib/format'
import { useAdminName } from '@/features/admins/api'

type Entry = components['schemas']['AuditEntry']
const route = getRouteApi('/app/audit')

/** Entity types written by the backend's AuditService callers (checked against source). */
const ENTITY_TYPES = [
  'user',
  'kyc_profile',
  'investment',
  'bank_account',
  'withdrawal_request',
  'pnl_batch',
  'payment_account',
  'payment_setting',
  'fee_setting',
  'app_setting',
  'support_ticket',
  'document',
]
const ALL = 'ALL'

export function AuditPage() {
  const { entityType, entityId, limit } = route.useSearch()
  const navigate = route.useNavigate()
  const adminName = useAdminName()
  const [idText, setIdText] = useState(entityId ?? '')
  const q = useQuery({
    queryKey: ['audit', entityType, entityId, limit],
    queryFn: () =>
      unwrap(
        apiClient.GET('/api/v1/admin/audit-log', {
          params: { query: { entityType, entityId, limit } },
        }),
      ),
  })

  function applyId(e: FormEvent) {
    e.preventDefault()
    void navigate({ search: (s) => ({ ...s, entityId: idText.trim() || undefined }) })
  }

  const columns = useMemo<ColumnDef<Entry, unknown>[]>(
    () => [
      {
        id: 'when',
        header: 'When',
        accessorFn: (e) => e.createdAt ?? '',
        cell: ({ row }) => <DateTime value={row.original.createdAt} />,
      },
      {
        id: 'action',
        header: 'Action',
        accessorFn: (e) => e.action ?? '',
        cell: ({ row }) => <span className="font-bold">{humanize(row.original.action)}</span>,
      },
      {
        id: 'actor',
        header: 'Actor',
        cell: ({ row }) =>
          row.original.actorType === 'ADMIN'
            ? adminName(row.original.actorId)
            : `${humanize(row.original.actorType)}${row.original.actorId ? ` ${row.original.actorId.slice(0, 8)}…` : ''}`,
      },
      {
        id: 'entity',
        header: 'Entity',
        cell: ({ row }) => <span className="text-sm">{humanize(row.original.entityType)}</span>,
      },
      {
        id: 'entityId',
        header: 'Entity id',
        cell: ({ row }) =>
          row.original.entityId ? (
            <button
              type="button"
              className="text-brand font-mono text-xs hover:underline"
              onClick={(ev) => {
                ev.stopPropagation()
                setIdText(row.original.entityId!)
                void navigate({ search: (s) => ({ ...s, entityId: row.original.entityId }) })
              }}
            >
              {row.original.entityId.slice(0, 8)}…
            </button>
          ) : null,
      },
      {
        id: 'request',
        header: 'Request id',
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-[11px]">
            {row.original.requestId?.slice(0, 8)}
          </span>
        ),
      },
    ],
    [adminName, navigate],
  )

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every admin action, PII reveal and money movement, newest first. Values in before/after data are not shown here."
      />
      <DataTable
        label="Audit log"
        columns={columns}
        data={q.data}
        getRowId={(e) => String(e.id)}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        onRefresh={() => void q.refetch()}
        paging={{ mode: 'client', pageSize: 50 }}
        emptyTitle="No audit entries match"
        toolbar={
          <>
            <Select
              value={entityType ?? ALL}
              onValueChange={(v) =>
                void navigate({ search: (s) => ({ ...s, entityType: v === ALL ? undefined : v }) })
              }
            >
              <SelectTrigger className="h-9 w-48" aria-label="Filter by entity type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All entity types</SelectItem>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {humanize(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <form onSubmit={applyId} className="flex items-center gap-1">
              <Input
                aria-label="Filter by entity id"
                value={idText}
                onChange={(e) => setIdText(e.target.value)}
                placeholder="Entity id"
                className="h-9 w-64 font-mono text-xs"
              />
              <Button
                type="submit"
                variant="outline"
                size="icon"
                className="size-9"
                aria-label="Apply entity id filter"
              >
                <Search className="size-4" />
              </Button>
              {entityId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIdText('')
                    void navigate({ search: (s) => ({ ...s, entityId: undefined }) })
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </form>
            <Select
              value={String(limit)}
              onValueChange={(v) => void navigate({ search: (s) => ({ ...s, limit: Number(v) }) })}
            >
              <SelectTrigger className="h-9 w-32" aria-label="Number of entries">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[50, 100, 200, 500].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Last {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
    </>
  )
}
