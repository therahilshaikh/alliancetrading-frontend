import { useMemo, useState, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, MoreHorizontal, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { EmptyState, ErrorState } from './layout'

export interface RowAction<T> {
  label: string
  onSelect: (row: T) => void
  destructive?: boolean
  disabled?: boolean
  hidden?: boolean
}

/** PageResponse { items, page (0-based), size, totalItems, totalPages } */
interface ServerPaging {
  mode: 'server'
  page: number
  size: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
  onSizeChange?: (size: number) => void
}
/** Plain array returned by the API, paged in the browser. */
interface ClientPaging {
  mode: 'client'
  pageSize?: number
}
/** CursorPage { items, nextCursor } with "Load more". */
interface CursorPaging {
  mode: 'cursor'
  hasMore: boolean
  onLoadMore: () => void
  loadingMore?: boolean
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[] | undefined
  paging: ServerPaging | ClientPaging | CursorPaging
  getRowId?: (row: T) => string
  isLoading?: boolean
  isFetching?: boolean
  error?: unknown
  onRefresh?: () => void
  onRowClick?: (row: T) => void
  rowActions?: (row: T) => RowAction<T>[]
  toolbar?: ReactNode
  emptyTitle?: string
  emptyDescription?: ReactNode
  /** Accessible name for the table. */
  label: string
}

const SIZES = [10, 20, 50, 100]
const EMPTY: never[] = []
const SKELETON_ROWS = 8

export function DataTable<T>({
  columns,
  data,
  paging,
  getRowId,
  isLoading,
  isFetching,
  error,
  onRefresh,
  onRowClick,
  rowActions,
  toolbar,
  emptyTitle,
  emptyDescription,
  label,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [visibility, setVisibility] = useState<VisibilityState>({})
  const isClient = paging.mode === 'client'

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!rowActions) return columns
    return [
      ...columns,
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const actions = rowActions(row.original).filter((a) => !a.hidden)
          if (!actions.length) return null
          // Keep clicks/keys inside the menu from also triggering the row's onRowClick.
          const stop = (e: React.SyntheticEvent) => e.stopPropagation()
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Row actions"
                    onClick={stop}
                    onKeyDown={stop}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={stop} onKeyDown={stop}>
                  {actions.map((a) => (
                    <DropdownMenuItem
                      key={a.label}
                      disabled={a.disabled}
                      variant={a.destructive ? 'destructive' : 'default'}
                      onSelect={() => a.onSelect(row.original)}
                    >
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ]
  }, [columns, rowActions])

  // Must be referentially stable: a fresh [] each render (while a query is loading) makes
  // TanStack auto-reset the page index every render, which re-renders forever.
  const rowsData = data ?? (EMPTY as T[])
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 is not React Compiler-safe; we don't use the compiler.
  const table = useReactTable({
    data: rowsData,
    columns: allColumns,
    getRowId,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    // Sorting is client-side only (the API has no sort params); for server pages
    // it sorts the visible page, so only enable it for client mode.
    enableSorting: isClient,
    getSortedRowModel: isClient ? getSortedRowModel() : undefined,
    getPaginationRowModel: isClient ? getPaginationRowModel() : undefined,
    initialState: isClient ? { pagination: { pageIndex: 0, pageSize: paging.pageSize ?? 20 } } : undefined,
  })

  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide())
  const colCount = table.getVisibleLeafColumns().length
  const rows = table.getRowModel().rows

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-white/5">
        <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        {onRefresh ? (
          <Button variant="ghost" size="icon" aria-label="Refresh" onClick={onRefresh} disabled={isFetching}>
            <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
          </Button>
        ) : null}
        {hideable.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Choose columns">
                <Columns3 className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hideable.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={c.getIsVisible()}
                  onCheckedChange={(v) => c.toggleVisibility(!!v)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <Table aria-label={label} aria-busy={isLoading || isFetching}>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((h) => {
                const sorted = h.column.getIsSorted()
                return (
                  <TableHead
                    key={h.id}
                    className="text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase"
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                  >
                    {h.isPlaceholder ? null : h.column.getCanSort() ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sorted === 'asc' ? <ArrowUp className="size-3" /> : sorted === 'desc' ? <ArrowDown className="size-3" /> : null}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <TableRow key={`sk-${i}`} data-testid="skeleton-row" className="hover:bg-transparent">
                {Array.from({ length: colCount }, (_, j) => (
                  <TableCell key={j} className="py-3.5">
                    <div className="skeleton-bar h-3 w-full rounded-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : error ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colCount}>
                <ErrorState error={error} onRetry={onRefresh} />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colCount}>
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(onRowClick && 'cursor-pointer')}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick(row.original)
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Footer paging={paging} table={table} hasRows={rows.length > 0} />
    </div>
  )
}

function Footer<T>({
  paging,
  table,
  hasRows,
}: {
  paging: ServerPaging | ClientPaging | CursorPaging
  table: ReturnType<typeof useReactTable<T>>
  hasRows: boolean
}) {
  if (paging.mode === 'cursor') {
    if (!paging.hasMore) return null
    return (
      <div className="flex justify-center border-t border-slate-100 p-3 dark:border-white/5">
        <Button variant="outline" size="sm" onClick={paging.onLoadMore} disabled={paging.loadingMore}>
          {paging.loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      </div>
    )
  }

  const page = paging.mode === 'server' ? paging.page : table.getState().pagination.pageIndex
  const totalPages = paging.mode === 'server' ? paging.totalPages : table.getPageCount()
  const total = paging.mode === 'server' ? paging.totalItems : table.getPrePaginationRowModel().rows.length
  const size = paging.mode === 'server' ? paging.size : table.getState().pagination.pageSize
  if (!hasRows && page === 0) return null

  const go = (p: number) =>
    paging.mode === 'server' ? paging.onPageChange(p) : table.setPageIndex(p)
  const setSize = (s: number) =>
    paging.mode === 'server' ? paging.onSizeChange?.(s) : table.setPageSize(s)
  const canSize = paging.mode === 'client' || !!paging.onSizeChange

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm dark:border-white/5">
      <p className="text-muted-foreground tabular-nums">
        {total} {total === 1 ? 'item' : 'items'}
      </p>
      <div className="flex items-center gap-3">
        {canSize ? (
          <Select value={String(size)} onValueChange={(v) => setSize(Number(v))}>
            <SelectTrigger className="h-8 w-[88px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <span className="text-muted-foreground tabular-nums">
          Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
        </span>
        <Button variant="outline" size="icon" className="size-8" aria-label="Previous page" disabled={page <= 0} onClick={() => go(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Next page"
          disabled={page + 1 >= totalPages}
          onClick={() => go(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
