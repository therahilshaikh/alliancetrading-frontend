import { describe, expect, it } from 'vitest'
import { istToUtcIso, nowIST } from './effective-from'

describe('istToUtcIso', () => {
  it('interprets the date/time as IST', () => {
    expect(istToUtcIso('2026-11-01', '09:30')).toBe('2026-11-01T04:00:00.000Z')
    expect(istToUtcIso('2026-11-01', '00:15')).toBe('2026-10-31T18:45:00.000Z')
  })
  it('returns undefined for incomplete input', () => {
    expect(istToUtcIso(undefined, '09:30')).toBeUndefined()
    expect(istToUtcIso('2026-11-01', '9')).toBeUndefined()
  })
})

describe('nowIST', () => {
  it('returns the current IST date and minute', () => {
    expect(nowIST(new Date('2026-10-31T09:45:30Z'))).toEqual({ date: '2026-10-31', time: '15:15' })
  })
  it('rolls over to the next IST day before UTC does', () => {
    expect(nowIST(new Date('2026-10-31T19:00:00Z'))).toEqual({ date: '2026-11-01', time: '00:30' })
  })
  it('round-trips through istToUtcIso to the same minute', () => {
    const n = nowIST(new Date('2026-10-31T09:45:30Z'))
    expect(istToUtcIso(n.date, n.time)).toBe('2026-10-31T09:45:00.000Z')
  })
})
