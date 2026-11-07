import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toastError } from '@/lib/mutations'
import { CopyButton } from './copy-button'

export const PII_VISIBLE_MS = 30_000

/**
 * Masked by default. Click the eye → fetch (the server audit-logs each reveal) →
 * show for 30s → re-mask. The value lives only in component state: never
 * prefetched, cached in React Query, logged or persisted.
 */
export function PiiReveal({
  masked,
  label,
  fetchValue,
}: {
  masked: string | null | undefined
  /** e.g. "PAN", "Aadhaar", "account number" */
  label: string
  fetchValue: () => Promise<string>
}) {
  const [value, setValue] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  function hide() {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setValue(null)
    setSecondsLeft(0)
  }

  useEffect(() => hide, [])

  async function reveal() {
    setLoading(true)
    try {
      const v = await fetchValue()
      setValue(v)
      const until = Date.now() + PII_VISIBLE_MS
      setSecondsLeft(Math.ceil(PII_VISIBLE_MS / 1000))
      timer.current = setInterval(() => {
        const left = Math.ceil((until - Date.now()) / 1000)
        if (left <= 0) hide()
        else setSecondsLeft(left)
      }, 250)
    } catch (err) {
      toastError(err, `Couldn't reveal ${label}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-sm tracking-wide" aria-live="polite">
        {value ?? masked ?? '—'}
      </span>
      {value ? (
        <>
          <CopyButton value={value} label={`Copy ${label}`} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Hide ${label}`}
            onClick={hide}
          >
            <EyeOff className="size-3.5" />
          </Button>
          <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{secondsLeft}s</span>
        </>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={reveal}
          disabled={loading || !masked}
          aria-label={`Reveal ${label}`}
          title={`Reveal ${label}`}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
        </Button>
      )}
    </span>
  )
}
