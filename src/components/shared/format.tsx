import { cn } from '@/lib/utils'
import { formatDateTime, formatMoney, formatPlainDate } from '@/lib/format'

export function Money({
  value,
  className,
  signed = false,
}: {
  value: number | null | undefined
  className?: string
  /** Colour positive/negative values (P&L). */
  signed?: boolean
}) {
  const tone =
    signed && typeof value === 'number'
      ? value > 0
        ? 'text-emerald-700 dark:text-emerald-400'
        : value < 0
          ? 'text-rose-700 dark:text-rose-400'
          : ''
      : ''
  return (
    <span className={cn('tabular-nums whitespace-nowrap', tone, className)}>
      {signed && typeof value === 'number' && value > 0 ? '+' : ''}
      {formatMoney(value)}
    </span>
  )
}

/** ISO instant rendered in IST; full value available on hover. */
export function DateTime({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className={className}>—</span>
  return (
    <time dateTime={value} className={cn('whitespace-nowrap', className)} title={`${formatDateTime(value)} IST`}>
      {formatDateTime(value)}
    </time>
  )
}

/** YYYY-MM-DD shown as-is (no timezone conversion). */
export function PlainDate({ value, className }: { value: string | null | undefined; className?: string }) {
  return (
    <time dateTime={value ?? undefined} className={cn('whitespace-nowrap', className)}>
      {formatPlainDate(value)}
    </time>
  )
}
