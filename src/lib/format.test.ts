import { describe, expect, it } from 'vitest'
import {
  formatDateTime,
  formatFraction,
  formatLongDateIST,
  formatMoney,
  formatMoneyCompact,
  formatMoneyPlain,
  formatPercent,
  greetingIST,
  formatPlainDate,
  humanize,
  initials,
  todayIST,
} from './format'

describe('formatMoney', () => {
  it('uses Indian grouping and 2 decimals', () => {
    expect(formatMoney(100000)).toBe('₹1,00,000.00')
    expect(formatMoney(1234567.5)).toBe('₹12,34,567.50')
    expect(formatMoney(-250)).toBe('-₹250.00')
  })
  it('shows a dash for missing values', () => {
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney(null)).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('always renders in IST (UTC+05:30)', () => {
    expect(formatDateTime('2026-10-22T09:57:14Z')).toBe('22 Oct 2026, 03:27 PM')
    expect(formatDateTime('2026-10-21T19:00:00Z')).toBe('22 Oct 2026, 12:30 AM')
  })
  it('handles missing and invalid input', () => {
    expect(formatDateTime(undefined)).toBe('—')
    expect(formatDateTime('nope')).toBe('—')
  })
})

describe('formatPlainDate', () => {
  it('formats without timezone conversion', () => {
    expect(formatPlainDate('2026-01-01')).toBe('01 Jan 2026')
    expect(formatPlainDate('1990-12-31')).toBe('31 Dec 1990')
  })
})

describe('todayIST', () => {
  it('rolls over at IST midnight, not UTC', () => {
    expect(todayIST(new Date('2026-10-21T18:29:00Z'))).toBe('2026-10-21')
    expect(todayIST(new Date('2026-10-21T18:31:00Z'))).toBe('2026-10-22')
  })
})

describe('percent helpers', () => {
  it('formats P&L percentages and fee fractions', () => {
    expect(formatPercent(1)).toBe('1%')
    expect(formatPercent(-0.5)).toBe('-0.5%')
    expect(formatFraction(0.02)).toBe('2%')
    expect(formatFraction(0.055)).toBe('5.5%')
  })
})

describe('text helpers', () => {
  it('humanizes enums and builds initials', () => {
    expect(humanize('PAYOUT_FAILED')).toBe('Payout failed')
    expect(initials('Riya Sharma')).toBe('RS')
    expect(initials(undefined)).toBe('?')
  })
})

describe('formatMoneyPlain', () => {
  it('drops trailing .00 but keeps paise', () => {
    expect(formatMoneyPlain(18400)).toBe('₹18,400')
    expect(formatMoneyPlain(18400.5)).toBe('₹18,400.50')
    expect(formatMoneyPlain(undefined)).toBe('—')
  })
})

describe('formatMoneyCompact', () => {
  it('uses Indian compact units', () => {
    expect(formatMoneyCompact(1000000)).toBe('₹10L')
    expect(formatMoneyCompact(184000)).toBe('₹1.84L')
    expect(formatMoneyCompact(60000)).toBe('₹60K')
    expect(formatMoneyCompact(25000000)).toBe('₹2.5Cr')
    expect(formatMoneyCompact(950)).toBe('₹950')
  })
})

describe('formatLongDateIST / greetingIST', () => {
  // 2024-06-24 03:00 UTC = 08:30 IST, a Monday
  const morning = new Date('2024-06-24T03:00:00Z')
  it('formats the IST weekday and date', () => {
    expect(formatLongDateIST(morning)).toBe('Monday, 24 June')
    // 20:00 UTC on Sunday is already Monday in IST
    expect(formatLongDateIST(new Date('2024-06-23T20:00:00Z'))).toBe('Monday, 24 June')
  })
  it('greets by the IST hour', () => {
    expect(greetingIST(morning)).toBe('Good morning')
    expect(greetingIST(new Date('2024-06-24T08:30:00Z'))).toBe('Good afternoon')
    expect(greetingIST(new Date('2024-06-24T13:30:00Z'))).toBe('Good evening')
  })
})