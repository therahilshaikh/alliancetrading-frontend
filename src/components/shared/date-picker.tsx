import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatPlainDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** "YYYY-MM-DD" ↔ a local calendar Date (pure calendar day — no timezone conversion). */
export function plainToDate(value: string | undefined): Date | undefined {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined
}
export function dateToPlain(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/** Single-date picker whose value is a plain "YYYY-MM-DD" string. */
export function PlainDatePicker({
  value,
  onChange,
  max,
  min,
  id,
  placeholder = 'Pick a date',
  'aria-invalid': ariaInvalid,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
  /** Latest selectable day, "YYYY-MM-DD". */
  max?: string
  min?: string
  id?: string
  placeholder?: string
  'aria-invalid'?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = plainToDate(value)
  const maxDate = plainToDate(max)
  const minDate = plainToDate(min)
  const disabled = [
    ...(maxDate ? [{ after: maxDate }] : []),
    ...(minDate ? [{ before: minDate }] : []),
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={ariaInvalid}
          className={cn('h-10 w-full justify-start rounded-xl text-left font-normal', !value && 'text-muted-foreground')}
        >
          <CalendarIcon className="size-4" aria-hidden />
          {value ? formatPlainDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? maxDate}
          onSelect={(d) => {
            onChange(d ? dateToPlain(d) : undefined)
            setOpen(false)
          }}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  )
}
