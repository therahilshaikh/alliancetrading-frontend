import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { MoneyInput } from '@/components/shared/number-input'
import { useConfirm } from '@/components/shared/confirm'
import { Money } from '@/components/shared/format'
import type { components } from '@/api/schema'
import { usePaymentAccounts, usePaymentDefaults } from '../api'
import {
  paymentAssignmentSchema,
  savedAccount,
  toAccountRequest,
  type PaymentAssignmentValues,
} from '../schemas'
import { PaymentAccountChoice, type AccountChoiceErrors } from './payment-account-choice'

export type PaymentAssignmentRequest = components['schemas']['PaymentAssignmentRequest']

/**
 * Pick a saved company UPI account or enter a new one, plus the amount
 * (pre-filled from GET /admin/payment-accounts/defaults). Used for KYC
 * approval and for changing a member's assignment.
 */
export function PaymentAssignmentDialog({
  open,
  onOpenChange,
  title,
  description,
  memberName,
  memberMobile,
  initialAmount,
  submitLabel,
  confirmTitle,
  confirmDescription,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  memberName: string | undefined
  memberMobile: string | undefined
  /** Defaults to the configured default amount. */
  initialAmount?: number
  submitLabel: string
  confirmTitle: string
  confirmDescription: string
  onSubmit: (payment: PaymentAssignmentRequest) => Promise<unknown>
  pending: boolean
}) {
  const confirm = useConfirm()
  const accounts = usePaymentAccounts('ACTIVE')
  const defaults = usePaymentDefaults()

  const form = useForm<PaymentAssignmentValues>({
    resolver: zodResolver(paymentAssignmentSchema),
    defaultValues: { account: savedAccount(), amount: initialAmount } as PaymentAssignmentValues,
  })
  const { errors } = form.formState

  // Pre-fill from the configured defaults, but never over the admin's own input.
  const defaultAmount = defaults.data?.defaultAmount
  const defaultAccountId = defaults.data?.defaultPaymentAccountId
  useEffect(() => {
    if (!open) return
    if (defaultAmount !== undefined && form.getValues('amount') === undefined)
      form.setValue('amount', defaultAmount)
    const account = form.getValues('account')
    if (defaultAccountId && account.mode === 'saved' && !account.paymentAccountId) {
      form.setValue('account', savedAccount(defaultAccountId))
    }
  }, [open, defaultAmount, defaultAccountId, form])

  async function submit(values: PaymentAssignmentValues) {
    const { account } = values
    const saved =
      account.mode === 'saved'
        ? accounts.data?.find((a) => a.id === account.paymentAccountId)
        : undefined
    const ok = await confirm({
      title: confirmTitle,
      description: confirmDescription,
      details: [
        { label: 'Member', value: memberName },
        { label: 'Mobile', value: memberMobile },
        { label: 'Pay to UPI', value: account.mode === 'saved' ? saved?.vpa : account.vpa },
        { label: 'Payee', value: account.mode === 'saved' ? saved?.payeeName : account.payeeName },
        { label: 'Amount', value: <Money value={values.amount} /> },
        ...(account.mode === 'new'
          ? [{ label: 'Save UPI to list', value: account.saveToList ? 'Yes' : 'No' }]
          : []),
      ],
      confirmLabel: submitLabel,
    })
    if (!ok) return
    const request = toAccountRequest(account)
    await onSubmit({
      ...request,
      ...(account.mode === 'new' ? { saveToList: account.saveToList ?? true } : {}),
      amount: values.amount,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
            <Controller
              control={form.control}
              name="account"
              render={({ field }) => (
                <PaymentAccountChoice
                  value={field.value}
                  onChange={field.onChange}
                  errors={errors.account as AccountChoiceErrors | undefined}
                  showSaveToList
                />
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <MoneyInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  </FormControl>
                  <FormDescription>
                    {defaultAmount !== undefined ? (
                      <>
                        Default is <Money value={defaultAmount} />. You can change it for this
                        member.
                      </>
                    ) : (
                      'The amount this member pays.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
