import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DetailList } from './layout'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  /** Key facts restated before acting (member, amount, %, …). */
  details?: { label: string; value: ReactNode }[]
  /** Rich block below the details, e.g. a payout receipt. */
  summary?: ReactNode
  confirmLabel?: string
  destructive?: boolean
  /** Ask for a reason (shown to the member for rejections). */
  reason?: { label?: string; placeholder?: string; required?: boolean; minLength?: number }
}

/** null = cancelled. */
export type ConfirmResult = { reason?: string } | null

type ConfirmFn = (options: ConfirmOptions) => Promise<ConfirmResult>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [reason, setReason] = useState('')
  const resolver = useRef<((r: ConfirmResult) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    setReason('')
    return new Promise<ConfirmResult>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function close(result: ConfirmResult) {
    resolver.current?.(result)
    resolver.current = null
    setOptions(null)
  }

  const minLength = options?.reason ? (options.reason.minLength ?? (options.reason.required ? 3 : 0)) : 0
  const reasonInvalid = !!options?.reason && reason.trim().length < minLength

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!options} onOpenChange={(open) => !open && close(null)}>
        {options ? (
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{options.title}</AlertDialogTitle>
              {options.description ? (
                <AlertDialogDescription>{options.description}</AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>
            {options.details?.length ? (
              <div className="rounded-2xl bg-muted/60 p-4">
                <DetailList items={options.details} />
              </div>
            ) : null}
            {options.summary ?? null}
            {options.reason ? (
              <div className="space-y-2">
                <Label htmlFor="confirm-reason">
                  {options.reason.label ?? 'Reason'}
                  {options.reason.required ? ' (required)' : ''}
                </Label>
                <Textarea
                  id="confirm-reason"
                  value={reason}
                  placeholder={options.reason.placeholder}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  aria-invalid={reasonInvalid}
                />
                {minLength > 0 ? (
                  <p className="text-xs text-muted-foreground">At least {minLength} characters.</p>
                ) : null}
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant={options.destructive ? 'destructive' : 'default'}
                disabled={reasonInvalid}
                onClick={() => close({ reason: options.reason ? reason.trim() : undefined })}
              >
                {options.confirmLabel ?? 'Confirm'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
