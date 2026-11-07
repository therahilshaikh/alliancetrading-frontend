import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput, PasswordMatchHint } from '@/components/shared/password-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/layout'
import { StatusBadge } from '@/components/shared/status-badge'
import { apiClient } from '@/api/client'
import { unwrap } from '@/api/http'
import { humanize } from '@/lib/format'
import { useApiMutation } from '@/lib/mutations'
import { useAuth } from '@/app/auth'
import { pnlKeys } from '@/features/pnl/api'
import { adminKeys, useAdminUsers, type AdminUser } from '../api'
import {
  newPasswordField,
  newPasswordShape,
  PASSWORD_HINT,
  passwordsMatch,
  passwordsMismatchError,
} from '../password'

// Names appear in the directory and the P&L approver picker, so refresh both.
const INVALIDATE = [adminKeys.all, pnlKeys.approvers]

const displayName = z.string().trim().min(1, 'Enter a name').max(100, 'At most 100 characters')

const createSchema = z
  .object({
    displayName,
    email: z.string().trim().email('Enter a valid email'),
    role: z.enum(['ADMIN', 'SUPER_ADMIN']),
    password: newPasswordField,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' })
type CreateValues = z.infer<typeof createSchema>

const renameSchema = z.object({ displayName })
type RenameValues = z.infer<typeof renameSchema>

/** SUPER_ADMIN only — the route is wrapped in RequireRole and the server returns 403 otherwise. */
export function AdminUsersPage() {
  const q = useAdminUsers()
  const [creating, setCreating] = useState(false)
  const { adminId } = useAuth()
  const [renaming, setRenaming] = useState<AdminUser | null>(null)
  const [resetting, setResetting] = useState<AdminUser | null>(null)

  const columns = useMemo<ColumnDef<AdminUser, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (a) => a.displayName ?? '',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-bold">{row.original.displayName || '—'}</p>
            <p className="text-muted-foreground truncate text-xs">{row.original.email}</p>
          </div>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        accessorFn: (a) => a.role ?? '',
        cell: ({ row }) => humanize(row.original.role),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setRenaming(row.original)}>
              <Pencil className="size-4" /> Rename
            </Button>
            {/* Own password is changed from the account menu (the server refuses a self-reset). */}
            {row.original.id !== adminId ? (
              <Button variant="ghost" size="sm" onClick={() => setResetting(row.original)}>
                <KeyRound className="size-4" /> Reset password
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [adminId],
  )

  return (
    <>
      <PageHeader
        title="Admin users"
        description="Console accounts. Only super admins can see and create them."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New admin
          </Button>
        }
      />
      <DataTable
        label="Admin users"
        columns={columns}
        data={q.data}
        getRowId={(a) => a.id ?? ''}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        onRefresh={() => void q.refetch()}
        paging={{ mode: 'client' }}
        emptyTitle="No admins"
      />
      <CreateAdminDialog key={creating ? 'o' : 'c'} open={creating} onOpenChange={setCreating} />
      {renaming ? (
        <RenameAdminDialog key={renaming.id} admin={renaming} onClose={() => setRenaming(null)} />
      ) : null}
      {resetting ? (
        <ResetPasswordDialog
          key={resetting.id}
          admin={resetting}
          onClose={() => setResetting(null)}
        />
      ) : null}
    </>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-destructive text-sm">{message}</p> : null
}

function CreateAdminDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { displayName: '', email: '', role: 'ADMIN', password: '', confirm: '' },
  })
  const { errors } = form.formState
  const [typedPassword, typedConfirm] = useWatch({
    control: form.control,
    name: ['password', 'confirm'],
  })
  const create = useApiMutation({
    mutationFn: (v: CreateValues) =>
      unwrap(
        apiClient.POST('/api/v1/admin/admin-users', {
          body: { displayName: v.displayName, email: v.email, role: v.role, password: v.password },
        }),
      ),
    success: (a) => `Admin ${a?.displayName ?? ''} created`,
    invalidate: INVALIDATE,
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>New admin</DialogTitle>
          <DialogDescription>
            Share the password with them securely. They sign in with email and password.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            await create.mutateAsync(v)
            onOpenChange(false)
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="na-name">Name</Label>
            <Input
              id="na-name"
              autoComplete="off"
              {...form.register('displayName')}
              aria-invalid={!!errors.displayName}
            />
            <p
              className={
                errors.displayName ? 'text-destructive text-sm' : 'text-muted-foreground text-xs'
              }
            >
              {errors.displayName?.message ??
                'Shown to other admins, e.g. in approvals and the audit log.'}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="na-email">Email</Label>
            <Input
              id="na-email"
              type="email"
              autoComplete="off"
              {...form.register('email')}
              aria-invalid={!!errors.email}
            />
            <FieldError message={errors.email?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="na-role">Role</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="na-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super admin (can manage admins)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="na-pass">Password</Label>
            <PasswordInput
              id="na-pass"
              autoComplete="new-password"
              {...form.register('password')}
              aria-invalid={!!errors.password}
            />
            <p
              className={
                errors.password ? 'text-destructive text-sm' : 'text-muted-foreground text-xs'
              }
            >
              {errors.password?.message ?? PASSWORD_HINT}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="na-confirm">Confirm password</Label>
            <PasswordInput
              id="na-confirm"
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create admin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameAdminDialog({ admin, onClose }: { admin: AdminUser; onClose: () => void }) {
  const { adminId, updateAdmin } = useAuth()
  const form = useForm<RenameValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: { displayName: admin.displayName ?? '' },
  })
  const { errors, isDirty } = form.formState
  const rename = useApiMutation({
    mutationFn: (v: RenameValues) =>
      unwrap(
        apiClient.PATCH('/api/v1/admin/admin-users/{id}', {
          params: { path: { id: admin.id ?? '' } },
          body: { displayName: v.displayName },
        }),
      ),
    success: (a) => `Renamed to ${a?.displayName ?? ''}`,
    invalidate: INVALIDATE,
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Rename admin</DialogTitle>
          <DialogDescription>{admin.email}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            const updated = await rename.mutateAsync(v)
            // Own name shows in the greeting and account menu.
            if (admin.id === adminId && updated?.displayName)
              updateAdmin({ displayName: updated.displayName })
            onClose()
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="ra-name">Name</Label>
            <Input
              id="ra-name"
              autoComplete="off"
              {...form.register('displayName')}
              aria-invalid={!!errors.displayName}
            />
            <FieldError message={errors.displayName?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={rename.isPending || !isDirty}>
              {rename.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save name
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const resetSchema = z.object(newPasswordShape).refine(passwordsMatch, passwordsMismatchError)
type ResetValues = z.infer<typeof resetSchema>

/** SUPER_ADMIN, another admin only. Clears their lockout and signs them out everywhere. */
function ResetPasswordDialog({ admin, onClose }: { admin: AdminUser; onClose: () => void }) {
  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirm: '' },
  })
  const { errors } = form.formState
  const [typedPassword, typedConfirm] = useWatch({
    control: form.control,
    name: ['newPassword', 'confirm'],
  })
  const reset = useApiMutation({
    mutationFn: (v: ResetValues) =>
      unwrap(
        apiClient.POST('/api/v1/admin/admin-users/{id}/reset-password', {
          params: { path: { id: admin.id ?? '' } },
          body: { newPassword: v.newPassword },
        }),
      ),
    success: `Password reset for ${admin.displayName || admin.email}`,
    invalidate: [adminKeys.all],
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            {admin.displayName || admin.email} ({admin.email}) will be signed out on every device
            and any lockout is cleared. Share the new password with them securely.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            await reset.mutateAsync(v)
            onClose()
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="rp-new">New password</Label>
            <PasswordInput
              id="rp-new"
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
            <Label htmlFor="rp-confirm">Confirm new password</Label>
            <PasswordInput
              id="rp-confirm"
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={reset.isPending}>
              {reset.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
