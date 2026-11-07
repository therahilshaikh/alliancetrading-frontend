import { AlertTriangle } from 'lucide-react'
import { WarningBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'

/** Threshold label from the server (PreviewResult.largeChangeThresholdPct), e.g. "10%". */
const pctLabel = (threshold: number | undefined) => `${threshold ?? 10}%`

/** Row badge for AllocationPreview.largeChange (|change| > threshold × principal). */
export function LargeChangeBadge({ threshold }: { threshold: number | undefined }) {
  return <WarningBadge>Over {pctLabel(threshold)}</WarningBadge>
}

/** One summary line instead of a warning per member. Renders nothing when no row is flagged. */
export function LargeChangeSummary({
  count,
  threshold,
  className,
}: {
  count: number
  threshold: number | undefined
  className?: string
}) {
  if (!count) return null
  return (
    <p
      role="status"
      className={cn(
        'flex gap-2 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <strong>
          {count} {count === 1 ? 'member gets' : 'members get'} more than {pctLabel(threshold)} of
          their principal.
        </strong>{' '}
        Check the value before sending. This is a reminder, not a block.
      </span>
    </p>
  )
}
