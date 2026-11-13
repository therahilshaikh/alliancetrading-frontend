import { Money } from '@/components/shared/format'
import type { components } from '@/api/schema'

type Tranche = components['schemas']['TranchePreview'] &
  components['schemas']['TrancheAllocationResponse']

/** Per-investment split of a member's amount; expandable when there is more than one. */
export function TrancheBreakdown({ tranches }: { tranches?: Tranche[] }) {
  const list = tranches ?? []
  if (list.length === 0) return <span className="text-slate-400">—</span>
  if (list.length === 1) return <span className="text-xs text-slate-500">1 investment</span>
  return (
    <details className="text-xs">
      <summary className="text-brand cursor-pointer font-bold select-none">
        {list.length} investments
      </summary>
      <ul className="mt-2 space-y-1">
        {list.map((t, i) => (
          <li key={t.investmentId ?? i} className="flex justify-between gap-4 tabular-nums">
            <span className="text-slate-500" title={t.investmentId}>
              #{i + 1}
              {t.earningPrincipal !== undefined ? (
                <>
                  {' · '}
                  <Money value={t.earningPrincipal} /> principal
                </>
              ) : null}
            </span>
            <Money value={t.amount} signed className="font-bold" />
          </li>
        ))}
      </ul>
    </details>
  )
}
