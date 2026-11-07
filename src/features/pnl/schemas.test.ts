import { describe, expect, it } from 'vitest'
import { makePnlSchema, sumAmounts, toBatchRequest, toPreviewRequest } from './schemas'

const TODAY = '2026-10-22'
const APPROVER = '1e639c71-3204-49bc-a177-024620ab1df5'
const INV_A = '24f0bb37-3735-419d-8942-135be95973ab'
const INV_B = '9b2b6a1e-5c4f-4b8e-9f0a-1c2d3e4f5a6b'
const schema = makePnlSchema(TODAY)

const base = {
  audience: 'all' as 'all' | 'selected',
  entry: 'profit' as 'profit' | 'loss',
  valueType: 'FIXED' as 'FIXED' | 'PERCENTAGE',
  sessionDate: TODAY,
  approverAdminId: APPROVER as string,
  members: [] as { investmentId: string; name: string; value?: number }[],
}
const issues = (v: unknown) => {
  const r = schema.safeParse(v)
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

describe('P&L form — all active members', () => {
  it('Fixed: one ALL line with the per-member amount, no controlTotal', () => {
    const body = toBatchRequest(schema.parse({ ...base, value: 200 }))
    expect(body.valueType).toBe('FIXED')
    expect(body.controlTotal).toBeUndefined()
    expect(body.lines).toEqual([{ targetType: 'ALL', amount: 200 }])
  })

  it('Loss makes values negative', () => {
    expect(
      toBatchRequest(schema.parse({ ...base, entry: 'loss', value: 1500.1 })).lines[0],
    ).toEqual({ targetType: 'ALL', amount: -1500.1 })
    expect(
      toBatchRequest(schema.parse({ ...base, valueType: 'PERCENTAGE', entry: 'loss', value: 0.75 }))
        .lines[0],
    ).toEqual({
      targetType: 'ALL',
      percentage: -0.75,
    })
  })

  it('Percentage: sends percentage only', () => {
    const body = toBatchRequest(schema.parse({ ...base, valueType: 'PERCENTAGE', value: 1 }))
    expect(body.controlTotal).toBeUndefined()
    expect(body.lines).toEqual([{ targetType: 'ALL', percentage: 1 }])
  })

  it('rejects missing/zero values and percentages over 100', () => {
    expect(issues(base)[0]).toMatch(/^value: Enter an amount/)
    expect(issues({ ...base, value: 0.001 })[0]).toMatch(/^value: Enter an amount/)
    expect(issues({ ...base, valueType: 'PERCENTAGE', value: 150 })[0]).toMatch(/100% or less/)
  })

  it('rejects future session dates and a missing approver; trims empty notes', () => {
    expect(issues({ ...base, value: 1, sessionDate: '2026-10-23' })[0]).toMatch(/future/)
    expect(issues({ ...base, value: 1, approverAdminId: '' })[0]).toMatch(/approverAdminId/)
    expect(toBatchRequest(schema.parse({ ...base, value: 1, notes: '  ' })).notes).toBeUndefined()
  })
})

describe('P&L form — selected members', () => {
  const members = [
    { investmentId: INV_A, name: 'A', value: 0.1 },
    { investmentId: INV_B, name: 'B', value: 0.2 },
  ]
  const sel = { ...base, audience: 'selected' as const, members }

  it('sums fixed amounts exactly in paise (display only)', () => {
    expect(sumAmounts(members)).toBe(0.3)
  })

  it('one INVESTMENT line per member', () => {
    expect(toBatchRequest(schema.parse(sel)).lines).toEqual([
      { targetType: 'INVESTMENT', investmentId: INV_A, amount: 0.1 },
      { targetType: 'INVESTMENT', investmentId: INV_B, amount: 0.2 },
    ])
    expect(
      toBatchRequest(schema.parse({ ...sel, valueType: 'PERCENTAGE', entry: 'loss' })).lines.map(
        (l) => l.percentage,
      ),
    ).toEqual([-0.1, -0.2])
  })

  it('requires at least one member and a value for each', () => {
    expect(issues({ ...sel, members: [] })[0]).toMatch(/^members: Select at least one member/)
    expect(issues({ ...sel, members: [{ investmentId: INV_A, name: 'A' }] })[0]).toMatch(
      /^members.0.value/,
    )
  })
})

describe('dry-run preview body', () => {
  it('is null until there is a value to preview', () => {
    expect(toPreviewRequest({ ...base, approverAdminId: '' })).toBeNull()
    expect(
      toPreviewRequest({
        ...base,
        audience: 'selected',
        members: [{ investmentId: INV_A, name: 'A' }],
      }),
    ).toBeNull()
    expect(toPreviewRequest({ ...base, valueType: 'PERCENTAGE', value: 150 })).toBeNull()
  })

  it('omits a missing approver and skips members without a value', () => {
    const body = toPreviewRequest({
      ...base,
      approverAdminId: '',
      audience: 'selected',
      members: [
        { investmentId: INV_A, name: 'A', value: 50 },
        { investmentId: INV_B, name: 'B' },
      ],
    })
    expect(body).toEqual({
      sessionDate: TODAY,
      valueType: 'FIXED',
      approverAdminId: undefined,
      lines: [{ targetType: 'INVESTMENT', investmentId: INV_A, amount: 50 }],
    })
  })
})
