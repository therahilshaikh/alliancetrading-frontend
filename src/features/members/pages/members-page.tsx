import { useEffect, useMemo, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { DateTime, Money } from '@/components/shared/format'
import { PageHeader } from '@/components/shared/layout'
import { StatusBadge } from '@/components/shared/status-badge'
import { humanize } from '@/lib/format'
import { MemberName } from '@/features/members/member-name'
import { useMembers, type MemberRow, type MemberStatus } from '../api'

const route = getRouteApi('/app/members')
const STATUSES: MemberStatus[] = [
  'REGISTERED',
  'KYC_SUBMITTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
]
const ALL = 'ALL'

export function MembersPage() {
  const { search, status, page, size } = route.useSearch()
  const navigate = route.useNavigate()
  const query = useMembers({ search, status, page, size })

  // Local input, pushed to the URL after typing pauses.
  const [text, setText] = useState(search ?? '')
  const [lastSearch, setLastSearch] = useState(search)
  if (search !== lastSearch) {
    setLastSearch(search)
    setText(search ?? '')
  }
  useEffect(() => {
    const t = setTimeout(() => {
      const next = text.trim() || undefined
      if (next !== search) void navigate({ search: (s) => ({ ...s, search: next, page: 0 }) })
    }, 350)
    return () => clearTimeout(t)
  }, [text, search, navigate])

  const columns = useMemo<ColumnDef<MemberRow, unknown>[]>(
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
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'investment',
        header: 'Investment',
        cell: ({ row }) =>
          row.original.liveInvestmentStatus ? (
            <StatusBadge status={row.original.liveInvestmentStatus} />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'principal',
        header: 'Principal',
        cell: ({ row }) => <Money value={row.original.principal} />,
      },
      {
        id: 'profit',
        header: 'Profit',
        cell: ({ row }) => <Money value={row.original.profit} signed />,
      },
      { id: 'held', header: 'Held', cell: ({ row }) => <Money value={row.original.held} /> },
      {
        id: 'joined',
        header: 'Joined',
        cell: ({ row }) => <DateTime value={row.original.joinedAt} />,
      },
    ],
    [],
  )

  return (
    <>
      <PageHeader
        title="Members"
        description="Search by name or mobile. Open a member to see KYC, bank, investments, payment and ledger."
      />
      <DataTable
        label="Members"
        columns={columns}
        data={query.data?.items}
        getRowId={(r) => r.userId ?? ''}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRefresh={() => void query.refetch()}
        onRowClick={(r) =>
          r.userId && void navigate({ to: '/members/$userId', params: { userId: r.userId } })
        }
        emptyTitle={search || status ? 'No members match these filters' : 'No members yet'}
        toolbar={
          <>
            <div className="relative w-full max-w-xs">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <Input
                aria-label="Search members by name or mobile"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Name or mobile"
                className="h-9 rounded-xl pl-9"
              />
            </div>
            <Select
              value={status ?? ALL}
              onValueChange={(v) =>
                void navigate({
                  search: (s) => ({
                    ...s,
                    status: v === ALL ? undefined : (v as MemberStatus),
                    page: 0,
                  }),
                })
              }
            >
              <SelectTrigger className="h-9 w-44" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {humanize(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
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
    </>
  )
}
