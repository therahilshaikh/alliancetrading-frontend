import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { errorMessage, errorRequestId } from '@/api/http'

/** Prototype "Panel": rounded-3xl bordered surface. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-extrabold tracking-wider text-brand uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function EmptyState({
  title = 'Nothing here',
  description,
  action,
  className,
}: {
  title?: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-14 text-center', className)}>
      <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand dark:bg-brand/15">
        <Inbox className="size-5" aria-hidden />
      </div>
      <p className="mt-2 text-sm font-extrabold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown
  onRetry?: () => void
  className?: string
}) {
  const requestId = errorRequestId(error)
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center gap-2 px-6 py-14 text-center', className)}
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <p className="mt-2 text-sm font-extrabold">Couldn't load this</p>
      <p className="max-w-sm text-sm text-muted-foreground">{errorMessage(error)}</p>
      {requestId ? <p className="text-xs text-muted-foreground">Reference: {requestId}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      ) : null}
    </div>
  )
}

/** A label/value list for detail sheets and confirm dialogs. */
export function DetailList({
  items,
  className,
}: {
  items: { label: string; value: ReactNode }[]
  className?: string
}) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{it.label}</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold">{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
