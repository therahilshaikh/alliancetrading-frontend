import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ColumnDef } from '@tanstack/react-table'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DataTable } from './data-table'

interface Row {
  id: string
  name: string
}
const columns: ColumnDef<Row, unknown>[] = [{ accessorKey: 'name', header: 'Name' }]
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Member ${i}` }))

const wrap = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>)

describe('DataTable', () => {
  it('server paging: shows totals and requests the next page', async () => {
    const onPageChange = vi.fn()
    wrap(
      <DataTable
        label="Members"
        columns={columns}
        data={rows(20)}
        getRowId={(r) => r.id}
        paging={{ mode: 'server', page: 0, size: 20, totalItems: 45, totalPages: 3, onPageChange }}
      />,
    )
    expect(screen.getByText('45 items')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('server paging: disables Next on the last page', () => {
    wrap(
      <DataTable
        label="Members"
        columns={columns}
        data={rows(5)}
        paging={{ mode: 'server', page: 2, size: 20, totalItems: 45, totalPages: 3, onPageChange: vi.fn() }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('client paging: pages a plain array in the browser', async () => {
    wrap(<DataTable label="Members" columns={columns} data={rows(25)} paging={{ mode: 'client', pageSize: 20 }} />)
    expect(screen.getByText('Member 0')).toBeInTheDocument()
    expect(screen.queryByText('Member 24')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Member 24')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('cursor paging: Load more only while there is a next cursor', async () => {
    const onLoadMore = vi.fn()
    const { rerender } = wrap(
      <DataTable label="Ledger" columns={columns} data={rows(3)} paging={{ mode: 'cursor', hasMore: true, onLoadMore }} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(onLoadMore).toHaveBeenCalledOnce()
    rerender(
      <TooltipProvider>
        <DataTable label="Ledger" columns={columns} data={rows(3)} paging={{ mode: 'cursor', hasMore: false, onLoadMore }} />
      </TooltipProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('shows skeleton rows while loading and an empty state when there is no data', () => {
    const { rerender } = wrap(
      <DataTable label="Members" columns={columns} data={undefined} isLoading paging={{ mode: 'client' }} />,
    )
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(8)
    rerender(
      <TooltipProvider>
        <DataTable label="Members" columns={columns} data={[]} paging={{ mode: 'client' }} emptyTitle="No members" />
      </TooltipProvider>,
    )
    expect(screen.getByText('No members')).toBeInTheDocument()
  })

  it('row actions run against the clicked row', async () => {
    const onSelect = vi.fn()
    wrap(
      <DataTable
        label="Members"
        columns={columns}
        data={rows(1)}
        paging={{ mode: 'client' }}
        rowActions={() => [{ label: 'Suspend', onSelect, destructive: true }]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Row actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Suspend' }))
    expect(onSelect).toHaveBeenCalledWith({ id: '0', name: 'Member 0' })
  })
})
