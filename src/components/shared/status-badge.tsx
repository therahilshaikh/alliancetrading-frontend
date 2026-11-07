import { cn } from '@/lib/utils'
import { humanize } from '@/lib/format'

type Tone = 'pending' | 'success' | 'danger' | 'info' | 'neutral' | 'muted' | 'special'

const TONES: Record<Tone, string> = {
  pending: 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-400',
  danger: 'bg-rose-50 text-rose-800 dark:bg-rose-400/10 dark:text-rose-400',
  info: 'bg-brand-soft text-brand-dark dark:bg-brand/15 dark:text-indigo-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
  muted: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400',
  special: 'bg-violet-50 text-violet-800 dark:bg-violet-400/10 dark:text-violet-300',
}

/**
 * One colour map for every backend enum. Values that appear in several enums
 * (e.g. APPROVED, REJECTED) mean the same thing everywhere, so one entry suffices.
 */
const STATUS_TONE: Record<string, Tone> = {
  // members
  REGISTERED: 'neutral',
  KYC_SUBMITTED: 'pending',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUSPENDED: 'muted',
  // investments
  PENDING_VERIFICATION: 'pending',
  ACTIVE: 'success',
  CLOSED: 'muted',
  // bank accounts
  VERIFIED: 'success',
  REPLACED: 'muted',
  // payment accounts
  ARCHIVED: 'muted',
  // P&L batches
  DRAFT: 'pending',
  // withdrawals
  REQUESTED: 'pending',
  PAID: 'special',
  PAYOUT_FAILED: 'danger',
  CANCELLED: 'muted',
  // support
  OPEN: 'info',
  RESOLVED: 'muted',
  TRADING: 'success',
  HIGH: 'danger',
  NORMAL: 'neutral',
}

const LABELS: Record<string, string> = {
  KYC_SUBMITTED: 'KYC submitted',
  PENDING_VERIFICATION: 'Pending',
  PAYOUT_FAILED: 'Payout failed',
}

export function StatusBadge({
  status,
  className,
  label,
}: {
  status: string | null | undefined
  className?: string
  label?: string
}) {
  if (!status) return null
  const tone = STATUS_TONE[status] ?? 'neutral'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase',
        TONES[tone],
        className,
      )}
    >
      {label ?? LABELS[status] ?? humanize(status)}
    </span>
  )
}

/** Small amber warning pill (e.g. name mismatch, second approval needed). */
export function WarningBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase',
        TONES.pending,
        className,
      )}
    >
      {children}
    </span>
  )
}
