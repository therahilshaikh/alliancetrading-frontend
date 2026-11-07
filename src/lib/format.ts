/** Display formatters. Values are shown exactly as the API returns them — no money maths. */

export const IST = 'Asia/Kolkata'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** ₹1,00,000.00 (Indian grouping). Dash for missing values. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return inr.format(value)
}

const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 })

/** ₹18,400 — like formatMoney but without trailing ".00"; paise still shown when present. */
export function formatMoneyPlain(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return Number.isInteger(value) ? inrWhole.format(value) : inr.format(value)
}

const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 2,
})

/** Headline figures: ₹60K, ₹1.84L, ₹2.5Cr (Indian compact notation). */
export function formatMoneyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return inrCompact.format(value).replace(/\s/g, '')
}

const istLongDate = new Intl.DateTimeFormat('en-GB', { timeZone: IST, weekday: 'long', day: 'numeric', month: 'long' })

/** "Monday, 24 June" in IST. */
export function formatLongDateIST(now: Date = new Date()): string {
  const p = Object.fromEntries(istLongDate.formatToParts(now).map((x) => [x.type, x.value]))
  return `${p.weekday}, ${p.day} ${p.month}`
}

/** "Good morning" / "Good afternoon" / "Good evening" by the IST hour. */
export function greetingIST(now: Date = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', hourCycle: 'h23' }).format(now))
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const istParts = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

/** ISO-8601 UTC instant → "22 Oct 2026, 03:27 PM" in IST, for every admin. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = Object.fromEntries(istParts.formatToParts(d).map((x) => [x.type, x.value]))
  const hour = p.hour === '00' ? '12' : p.hour
  return `${p.day} ${p.month} ${p.year}, ${hour}:${p.minute} ${(p.dayPeriod ?? '').toUpperCase()}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Plain date "YYYY-MM-DD" → "22 Oct 2026". Never passed through Date (no TZ shift). */
export function formatPlainDate(value: string | null | undefined): string {
  if (!value) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return value
  const month = MONTHS[Number(m[2]) - 1]
  return month ? `${m[3]} ${month} ${m[1]}` : value
}

/** Today's calendar date in IST as "YYYY-MM-DD". */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(now)
}

/** P&L percentage (percent units: 1 = 1%). */
export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`
}

/** Fee fraction (0.02) → "2%". */
export function formatFraction(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return formatPercent(Math.round(value * 100 * 10 ** digits) / 10 ** digits, digits)
}

/** "SECOND_APPROVAL_THRESHOLD" → "Second approval threshold". */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  const s = value.replace(/_/g, ' ').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}
