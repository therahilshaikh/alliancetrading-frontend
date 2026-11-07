import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Combobox } from '@/components/shared/combobox'
import { DocumentUpload } from '@/components/shared/document-upload'
import { usePaymentAccounts } from '../api'
import type { AccountChoice } from '../schemas'

type FieldName = 'paymentAccountId' | 'vpa' | 'payeeName' | 'label'
export type AccountChoiceErrors = Partial<Record<FieldName, { message?: string } | undefined>>

/**
 * Pick a saved company UPI account or enter a new one. Controlled: wire it to
 * a form with <Controller>, passing the nested field errors.
 */
export function PaymentAccountChoice({
  value,
  onChange,
  errors,
  showSaveToList = false,
  showQrUpload = false,
  onUploadingChange,
  disabled,
}: {
  value: AccountChoice
  onChange: (next: AccountChoice) => void
  errors?: AccountChoiceErrors
  /** Member assignment: a new UPI can be used once without saving it. */
  showSaveToList?: boolean
  /** Default payment: a new account can carry its own QR image. */
  showQrUpload?: boolean
  onUploadingChange?: (busy: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  const accounts = usePaymentAccounts('ACTIVE')
  const options = (accounts.data ?? []).map((a) => ({
    value: a.id ?? '',
    label: a.label || a.payeeName || a.vpa || 'Account',
    hint: [a.vpa, a.payeeName].filter(Boolean).join(' · '),
  }))

  function switchMode(mode: string) {
    if (mode === value.mode) return
    onChange(
      mode === 'new'
        ? {
            mode: 'new',
            label: '',
            vpa: '',
            payeeName: '',
            saveToList: showSaveToList ? true : undefined,
          }
        : { mode: 'saved', paymentAccountId: '' },
    )
  }

  const err = (name: FieldName) => errors?.[name]?.message

  return (
    <div className="space-y-4">
      <Tabs value={value.mode} onValueChange={switchMode}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="saved" disabled={disabled}>
            Saved account
          </TabsTrigger>
          <TabsTrigger value="new" disabled={disabled}>
            New UPI
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {value.mode === 'saved' ? (
        <div className="space-y-2">
          <Label htmlFor={`${id}-account`}>Payment account</Label>
          <Combobox
            id={`${id}-account`}
            options={options}
            value={value.paymentAccountId || undefined}
            onChange={(paymentAccountId) =>
              onChange({ mode: 'saved', paymentAccountId: paymentAccountId ?? '' })
            }
            loading={accounts.isLoading}
            placeholder="Select a UPI account"
            searchPlaceholder="Search label, UPI ID, payee"
            emptyText="No active accounts. Use New UPI."
            aria-invalid={!!err('paymentAccountId')}
          />
          {err('paymentAccountId') ? (
            <p className="text-destructive text-sm">{err('paymentAccountId')}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${id}-vpa`}>UPI ID</Label>
            <Input
              id={`${id}-vpa`}
              value={value.vpa}
              onChange={(e) => onChange({ ...value, vpa: e.target.value })}
              placeholder="alliance@okaxis"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!err('vpa')}
              disabled={disabled}
            />
            {err('vpa') ? <p className="text-destructive text-sm">{err('vpa')}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-payee`}>Payee name</Label>
            <Input
              id={`${id}-payee`}
              value={value.payeeName}
              onChange={(e) => onChange({ ...value, payeeName: e.target.value })}
              aria-invalid={!!err('payeeName')}
              disabled={disabled}
            />
            {err('payeeName') ? (
              <p className="text-destructive text-sm">{err('payeeName')}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-label`}>Label (optional)</Label>
            <Input
              id={`${id}-label`}
              value={value.label ?? ''}
              onChange={(e) => onChange({ ...value, label: e.target.value })}
              placeholder="e.g. HDFC current"
              aria-invalid={!!err('label')}
              disabled={disabled}
            />
            {err('label') ? <p className="text-destructive text-sm">{err('label')}</p> : null}
          </div>
          {showQrUpload ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${id}-qr`}>QR image (optional)</Label>
              <DocumentUpload
                id={`${id}-qr`}
                docType="PAYMENT_QR"
                imagesOnly
                value={value.qrDocumentId}
                onChange={(qrDocumentId) => onChange({ ...value, qrDocumentId })}
                onBusyChange={onUploadingChange}
                disabled={disabled}
              />
              <p className="text-muted-foreground text-xs">
                Without one, a QR is generated from the UPI ID.
              </p>
            </div>
          ) : null}
          {showSaveToList ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border p-3 sm:col-span-2">
              <div>
                <Label htmlFor={`${id}-save`}>Save to payment accounts</Label>
                <p className="text-muted-foreground text-sm">
                  Reuse this UPI ID for other members.
                </p>
              </div>
              <Switch
                id={`${id}-save`}
                checked={value.saveToList ?? true}
                onCheckedChange={(saveToList) => onChange({ ...value, saveToList })}
                disabled={disabled}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
