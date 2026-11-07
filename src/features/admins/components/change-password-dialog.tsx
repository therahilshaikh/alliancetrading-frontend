import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PasswordInput, PasswordMatchHint } from '@/components/shared/password-input'
import { apiClient } from '@/api/client'
import { ApiError, errorMessage, errorRequestId, unwrap } from '@/api/http'
import { useAuth } from '@/app/auth'
import {
  newPasswordShape,
  PASSWORD_HINT,
  passwordsMatch,
  passwordsMismatchError,
} from '../password'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    ...newPasswordShape,
  })
  .refine(passwordsMatch, passwordsMismatchError)
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Must be different from your current password',
  })
type Values = z.infer<typeof schema>

/**
 * Any admin. The server revokes every session of this admin (other devices
 * are signed out) and returns a fresh session, which replaces ours at once.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { adoptSession } = useAuth()
  const [formError, setFormError] = useState<{ message: string; requestId?: string } | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  })
  const { errors } = form.formState
  const [typedPassword, typedConfirm] = useWatch({
    control: form.control,
    name: ['newPassword', 'confirm'],
  })

  const change = useMutation({
    mutationFn: (v: Values) =>
      unwrap(
        apiClient.POST('/api/v1/admin/auth/change-password', {
          body: { currentPassword: v.currentPassword, newPassword: v.newPassword },
        }),
      ),
  })

  async function submit(v: Values) {
    setFormError(null)
    try {
      const session = await change.mutateAsync(v)
      if (!adoptSession(session)) throw new Error('Unexpected response')
      toast.success('Password changed', { description: 'Other devices have been signed out.' })
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
        form.setError('currentPassword', { message: 'Current password is incorrect' })
        form.setFocus('currentPassword')
      } else {
        setFormError({
          message: errorMessage(err, 'Couldn’t change the password'),
          requestId: errorRequestId(err),
        })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            You stay signed in here. Your other devices will be signed out.
          </DialogDescription>
        </DialogHeader>
        <form noValidate className="space-y-4" onSubmit={form.handleSubmit(submit)}>
          <div className="space-y-2">
            <Label htmlFor="cp-current">Current password</Label>
            <PasswordInput
              id="cp-current"
              autoComplete="current-password"
              {...form.register('currentPassword')}
              aria-invalid={!!errors.currentPassword}
            />
            {errors.currentPassword ? (
              <p className="text-destructive text-sm">{errors.currentPassword.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-new">New password</Label>
            <PasswordInput
              id="cp-new"
              autoComplete="new-password"
              {...form.register('newPassword')}
              aria-invalid={!!errors.newPassword}
            />
            <p
              className={
                errors.newPassword ? 'text-destructive text-sm' : 'text-muted-foreground text-xs'
              }
            >
              {errors.newPassword?.message ?? PASSWORD_HINT}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-confirm">Confirm new password</Label>
            <PasswordInput
              id="cp-confirm"
              autoComplete="new-password"
              {...form.register('confirm')}
              aria-invalid={!!errors.confirm}
            />
            <PasswordMatchHint
              password={typedPassword}
              confirm={typedConfirm}
              error={errors.confirm?.message}
            />
          </div>
          {formError ? (
            <div
              role="alert"
              className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200"
            >
              <p>{formError.message}</p>
              {formError.requestId ? (
                <p className="mt-1 text-xs opacity-80">Reference: {formError.requestId}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
