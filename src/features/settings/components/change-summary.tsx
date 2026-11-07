import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ChangeRow {
  label: string
  /** Shown as-is; strings are also compared to mark the row as unchanged. */
  current: ReactNode
  next: ReactNode
}

/**
 * Current-vs-new table for settings confirms: one row per field, changed
 * values highlighted, unchanged ones marked so a no-op save is obvious.
 */
export function ChangeSummary({
  context,
  rows,
  effective,
}: {
  /** What the change applies to, e.g. "Profit withdrawals". */
  context?: { label: string; value: ReactNode }
  rows: ChangeRow[]
  effective: string
}) {
  const nothingChanges = rows.every(isSame)
  return (
    <div className="overflow-hidden rounded-2xl border">
      {context ? (
        <p className="bg-muted/40 border-b px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{context.label}: </span>
          <span className="font-bold">{context.value}</span>
        </p>
      ) : null}
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">Current and new values</caption>
        <thead>
          <tr className="text-muted-foreground border-b text-left text-[11px] font-bold tracking-wider uppercase">
            <th scope="col" className="w-[26%] px-4 py-2 font-bold">
              <span className="sr-only">Field</span>
            </th>
            <th scope="col" className="px-2 py-2 font-bold">
              Current
            </th>
            <th scope="col" className="px-4 py-2 font-bold">
              New
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const same = isSame(row)
            return (
              <tr key={row.label} className="border-b last:border-b-0">
                <th
                  scope="row"
                  className="text-muted-foreground px-4 py-2.5 text-left align-top font-medium"
                >
                  {row.label}
                </th>
                <td className="text-muted-foreground px-2 py-2.5 align-top break-words">
                  {row.current ?? '—'}
                </td>
                <td
                  className={cn(
                    'px-4 py-2.5 align-top break-words',
                    same ? 'text-muted-foreground' : 'text-brand font-bold dark:text-indigo-300',
                  )}
                >
                  {row.next ?? '—'}
                  <span className="sr-only">{same ? ' (unchanged)' : ' (changed)'}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="bg-muted/40 flex flex-wrap justify-between gap-2 border-t px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">Effective</span>
        <span className="font-semibold">{effective}</span>
      </p>
      {nothingChanges ? (
        <p className="border-t bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
          Nothing changes: the new values are the same as the current ones.
        </p>
      ) : null}
    </div>
  )
}

function isSame(row: ChangeRow) {
  return typeof row.current === 'string' && typeof row.next === 'string' && row.current === row.next
}
