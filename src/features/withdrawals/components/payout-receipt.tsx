import { Landmark } from 'lucide-react'
import { Money } from '@/components/shared/format'
import { formatFraction } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Withdrawal } from '../api'

/**
 * Checkout-style breakdown: line items, the fee as a deduction, a divider and
 * the payout as the total. Every figure is the server's (no client maths).
 */
export function PayoutReceipt({
  withdrawal: w,
  showPayTo = false,
  className,
}: {
  withdrawal: Withdrawal
  showPayTo?: boolean
  className?: string
}) {
  const fee = w.feeAmount ?? 0
  const payTo = [w.bankHolderName, w.bankAccountMasked, w.bankIfsc].filter(Boolean).join(' · ')

  return (
    <section
      aria-label="Payout summary"
      className={cn(
        'rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5',
        className,
      )}
    >
      <dl className="space-y-2.5 p-4 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">Requested amount</dt>
          <dd className="font-semibold tabular-nums">
            <Money value={w.grossAmount} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">
            Withdrawal fee
            {w.feePct ? (
              <span className="bg-muted ml-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold">
                {formatFraction(w.feePct)}
              </span>
            ) : null}
          </dt>
          <dd className="font-semibold tabular-nums">
            {fee > 0 ? (
              <span className="text-rose-600 dark:text-rose-400">
                <span aria-hidden>−&thinsp;</span>
                <span className="sr-only">minus </span>
                <Money value={fee} />
              </span>
            ) : (
              <span className="font-bold text-emerald-600 dark:text-emerald-400">No fee</span>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-slate-300 pt-3 dark:border-white/15">
          <dt className="font-extrabold">Member receives</dt>
          <dd className="text-xl font-extrabold tabular-nums">
            <Money value={w.netAmount} />
          </dd>
        </div>
      </dl>
      {showPayTo && payTo ? (
        <p className="bg-muted/50 text-muted-foreground flex items-center gap-2 rounded-b-2xl border-t border-slate-200 px-4 py-2.5 text-xs dark:border-white/10">
          <Landmark className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            Paid to <span className="text-foreground font-semibold">{payTo}</span>
          </span>
        </p>
      ) : null}
    </section>
  )
}
