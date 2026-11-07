import type { BaseSyntheticEvent } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { PlainDatePicker } from '@/components/shared/date-picker'
import { IST, todayIST } from '@/lib/format'

/** "YYYY-MM-DD" + "HH:mm" in IST → ISO-8601 UTC instant. */
export function istToUtcIso(
  date: string | undefined,
  time: string | undefined,
): string | undefined {
  if (!date || !time || !/^\d{2}:\d{2}$/.test(time)) return undefined
  const d = new Date(`${date}T${time}:00+05:30`)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** The current IST date and minute, the default "effective from". */
export function nowIST(now: Date = new Date()): { date: string; time: string } {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return { date: todayIST(now), time }
}

/**
 * Build a settings form's submit handler.
 *
 * - An untouched default means "now", so it moves to the current minute first;
 *   otherwise a form left open for a while would fail the "now or later" check
 *   with a time the admin never chose.
 * - `onSaved` runs only if the handler called `markSaved`, and only after
 *   handleSubmit has fully finished. Reset the form there, not inside the
 *   handler: handleSubmit marks the form submitted after the handler returns,
 *   so a reset inside it leaves the cleared fields re-validating ("Enter the
 *   amount") on the next change.
 */
export function settingsSubmit<T extends { date: string; time: string }, S = true>(
  form: UseFormReturn<T>,
  makeHandler: (markSaved: (saved: S) => void) => (e?: BaseSyntheticEvent) => Promise<void>,
  onSaved: (saved: S) => void,
) {
  const f = form as unknown as UseFormReturn<{ date: string; time: string }>
  return async (e?: BaseSyntheticEvent) => {
    if (!f.getFieldState('date').isDirty && !f.getFieldState('time').isDirty) {
      const n = nowIST()
      f.setValue('date', n.date)
      f.setValue('time', n.time)
    }
    let saved: { value: S } | undefined
    await makeHandler((value) => {
      saved = { value }
    })(e)
    if (saved) onSaved(saved.value)
  }
}
/** Effective-from picker: calendar date + 24h time, both IST. */
export function EffectiveFrom({
  date,
  time,
  onDate,
  onTime,
  idPrefix,
}: {
  date: string | undefined
  time: string
  onDate: (d: string | undefined) => void
  onTime: (t: string) => void
  idPrefix: string
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Effective from (IST)</legend>
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <PlainDatePicker id={`${idPrefix}-date`} value={date} onChange={onDate} min={todayIST()} />
        <Input
          id={`${idPrefix}-time`}
          type="time"
          value={time}
          onChange={(e) => onTime(e.target.value)}
          aria-label="Effective time (IST)"
          className="h-10 rounded-xl"
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Takes effect at this time once a different admin approves.
      </p>
    </fieldset>
  )
}
