import { useState, type ComponentProps } from 'react'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Password field with a show/hide toggle. Accepts every Input prop (incl. register()). */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        disabled={props.disabled}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-brand/40 absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md transition focus-visible:ring-2 focus-visible:outline-none"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  )
}

/**
 * Live "match" feedback under a confirm field, shown as soon as the admin
 * types in it (before submit). A submit-time error takes its place.
 */
export function PasswordMatchHint({
  password,
  confirm,
  error,
}: {
  password: string
  confirm: string
  error?: string
}) {
  if (error) return <p className="text-destructive text-sm">{error}</p>
  if (!confirm) return null
  const matches = password === confirm
  return (
    <p
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 text-sm',
        matches ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
      )}
    >
      {matches ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <X className="size-3.5" aria-hidden />
      )}
      {matches ? 'Passwords match' : 'Passwords don’t match'}
    </p>
  )
}
