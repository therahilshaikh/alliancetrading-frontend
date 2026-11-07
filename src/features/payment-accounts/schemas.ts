import { z } from 'zod'
import { VPA_PATTERN } from '@/lib/validation'

export const amount = z
  .number({ message: 'Enter the amount' })
  .positive('Amount must be more than ₹0')
  .max(99_99_99_999, 'Amount is too large')

export const vpaField = z
  .string()
  .trim()
  .max(100, 'UPI ID is too long')
  .regex(VPA_PATTERN, 'Enter a valid UPI ID, e.g. alliance@okaxis')

export const payeeField = z.string().trim().min(1, 'Payee name is required').max(100)

/**
 * A saved company UPI account, or a new one entered inline. Shared by the
 * member payment assignment and the default-payment setting.
 */
export const accountChoiceSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('saved'),
    paymentAccountId: z
      .string({ message: 'Choose a payment account' })
      .uuid('Choose a payment account'),
  }),
  z.object({
    mode: z.literal('new'),
    label: z.string().trim().max(100).optional(),
    vpa: vpaField,
    payeeName: payeeField,
    /** Member assignment only; the default-payment setting always saves the account. */
    saveToList: z.boolean().optional(),
    qrDocumentId: z.string().optional(),
  }),
])

export type AccountChoice = z.infer<typeof accountChoiceSchema>

/** Starting value: the given saved account (if any), otherwise nothing picked yet. */
export function savedAccount(paymentAccountId?: string): AccountChoice {
  return { mode: 'saved', paymentAccountId: paymentAccountId ?? '' }
}

/** API shape: `{ paymentAccountId }` or `{ newAccount }` (exactly one). */
export function toAccountRequest(choice: AccountChoice) {
  return choice.mode === 'saved'
    ? { paymentAccountId: choice.paymentAccountId }
    : {
        newAccount: {
          label: choice.label || undefined,
          vpa: choice.vpa,
          payeeName: choice.payeeName,
          qrDocumentId: choice.qrDocumentId,
        },
      }
}

export const paymentAssignmentSchema = z.object({ account: accountChoiceSchema, amount })

export type PaymentAssignmentValues = z.infer<typeof paymentAssignmentSchema>
