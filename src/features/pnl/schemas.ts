import { z } from 'zod'
import type { components } from '@/api/schema'

export type PnlBatchRequest = components['schemas']['PnlBatchRequest']
export type ValueType = 'FIXED' | 'PERCENTAGE'
export type Audience = 'all' | 'selected'
export type EntryType = 'profit' | 'loss'

const member = z.object({
  investmentId: z.string().uuid(),
  /** Display only. */
  name: z.string(),
  mobile: z.string().optional(),
  value: z.number().optional(),
})

export type SelectedMember = z.infer<typeof member>

/** Integer paise, so display sums are exact. */
export const toPaise = (rupees: number) => Math.round(rupees * 100)

/** Sum of selected members' fixed amounts in rupees (display arithmetic, allowed by §6.4). */
export function sumAmounts(members: { value?: number }[]): number {
  return members.reduce((acc, m) => acc + toPaise(m.value ?? 0), 0) / 100
}

/**
 * Values are entered as positive numbers; Profit/Loss decides the sign.
 * FIXED: every target investment gets exactly the amount.
 * PERCENTAGE: every target investment gets its own principal × percentage.
 * The server computes the total (controlTotal is not sent).
 */
export function makePnlSchema(today: string) {
  return z
    .object({
      audience: z.enum(['all', 'selected']),
      entry: z.enum(['profit', 'loss']),
      valueType: z.enum(['FIXED', 'PERCENTAGE']),
      value: z.number().optional(),
      members: z.array(member),
      sessionDate: z
        .string({ message: 'Pick the session date' })
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the session date')
        .refine((d) => d <= today, 'Session date can’t be in the future'),
      approverAdminId: z.string({ message: 'Choose an approver' }).uuid('Choose an approver'),
      notes: z.string().max(1000, 'Notes are too long (1000 max)').optional(),
    })
    .superRefine((v, ctx) => {
      const check = (n: number | undefined, path: (string | number)[]) => {
        if (n === undefined || n <= 0 || (v.valueType === 'FIXED' && toPaise(n) === 0)) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: v.valueType === 'FIXED' ? 'Enter an amount' : 'Enter a percentage',
          })
        } else if (v.valueType === 'PERCENTAGE' && n > 100) {
          ctx.addIssue({ code: 'custom', path, message: 'Must be 100% or less' })
        }
      }
      if (v.audience === 'all') {
        check(v.value, ['value'])
        return
      }
      if (!v.members.length)
        ctx.addIssue({ code: 'custom', path: ['members'], message: 'Select at least one member' })
      v.members.forEach((m, i) => check(m.value, ['members', i, 'value']))
    })
}

export type PnlFormValues = z.infer<ReturnType<typeof makePnlSchema>>

const signed = (n: number, v: Pick<PnlFormValues, 'entry' | 'valueType'>) => {
  const s = v.entry === 'loss' ? -1 : 1
  return v.valueType === 'FIXED' ? (toPaise(n) * s) / 100 : n * s
}

type LineRequest = PnlBatchRequest['lines'][number]

/** Lines for the form's current values; members without a value are skipped (preview only). */
function toLines(v: PnlFormValues): LineRequest[] {
  const raw: { targetType: 'ALL' | 'INVESTMENT'; investmentId?: string; value?: number }[] =
    v.audience === 'all'
      ? [{ targetType: 'ALL', value: v.value }]
      : v.members.map((m) => ({
          targetType: 'INVESTMENT',
          investmentId: m.investmentId,
          value: m.value,
        }))
  const out: LineRequest[] = []
  for (const { value, ...l } of raw) {
    if (value === undefined || value <= 0) continue
    out.push(
      v.valueType === 'FIXED'
        ? { ...l, amount: signed(value, v) }
        : { ...l, percentage: signed(value, v) },
    )
  }
  return out
}

/** Form values → create body. */
export function toBatchRequest(v: PnlFormValues): PnlBatchRequest {
  return {
    sessionDate: v.sessionDate,
    valueType: v.valueType,
    approverAdminId: v.approverAdminId,
    notes: v.notes?.trim() || undefined,
    lines: toLines(v),
  }
}

/** Body for the dry-run preview, or null while there is nothing to preview yet. */
export function toPreviewRequest(v: PnlFormValues): PnlBatchRequest | null {
  const lines = toLines(v)
  if (!lines.length || !v.sessionDate) return null
  if (v.valueType === 'PERCENTAGE' && lines.some((l) => Math.abs(l.percentage ?? 0) > 100))
    return null
  return {
    sessionDate: v.sessionDate,
    valueType: v.valueType,
    approverAdminId: v.approverAdminId || undefined,
    lines,
  }
}
