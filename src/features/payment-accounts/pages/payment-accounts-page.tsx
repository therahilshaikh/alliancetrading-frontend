import { useMemo, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfirm } from '@/components/shared/confirm'
import { DataTable } from '@/components/shared/data-table'
import { DocumentUpload } from '@/components/shared/document-upload'
import { DateTime } from '@/components/shared/format'
import { PageHeader } from '@/components/shared/layout'
import { StatusBadge } from '@/components/shared/status-badge'
import { apiClient } from '@/api/client'
import { ApiError, unwrap } from '@/api/http'
import { useApiMutation } from '@/lib/mutations'
import {
  paymentAccountKeys,
  usePaymentAccounts,
  usePaymentDefaults,
  type PaymentAccount,
  type PaymentAccountStatus,
} from '../api'
import { payeeField, vpaField } from '../schemas'

const route = getRouteApi('/app/payment-accounts')

const schema = z.object({
  label: z.string().trim().max(100).optional(),
  vpa: vpaField,
  payeeName: payeeField,
})
type Values = z.infer<typeof schema>

export function PaymentAccountsPage() {
  const { status } = route.useSearch()
  const navigate = route.useNavigate()
  const q = usePaymentAccounts(status)
  const confirm = useConfirm()
  const [addOpen, setAddOpen] = useState(false)
  const archive = useApiMutation({
    mutationFn: (id: string) =>
      unwrap(
        apiClient.POST('/api/v1/admin/payment-accounts/{id}/archive', { params: { path: { id } } }),
      ),
    success: 'Payment account archived',
    invalidate: [paymentAccountKeys.all],
    // The current (or a scheduled) default can't be archived; the fix is in Settings.
    errorAction: (err) =>
      err instanceof ApiError && err.code === 'PAYMENT_ACCOUNT_IN_USE'
        ? { label: 'Open Settings', onClick: () => void navigate({ to: '/settings' }) }
        : undefined,
  })
  const defaultAccountId = usePaymentDefaults().data?.defaultPaymentAccountId

  const columns = useMemo<ColumnDef<PaymentAccount, unknown>[]>(
    () => [
      {
        id: 'label',
        header: 'Label',
        accessorFn: (a) => a.label ?? '',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            <span className="font-bold">{row.original.label || '—'}</span>
            {row.original.id === defaultAccountId ? (
              <span className="bg-brand-soft text-brand dark:bg-brand/15 rounded-full px-2 py-0.5 text-[11px] font-bold dark:text-indigo-300">
                Default
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'vpa',
        header: 'UPI ID',
        accessorFn: (a) => a.vpa ?? '',
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.vpa}</span>,
      },
      {
        id: 'payee',
        header: 'Payee',
        accessorFn: (a) => a.payeeName ?? '',
        cell: ({ row }) => row.original.payeeName,
      },
      {
        id: 'qr',
        header: 'QR',
        cell: ({ row }) => (row.original.hasUploadedQr ? 'Uploaded' : 'Generated'),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'created',
        header: 'Created',
        accessorFn: (a) => a.createdAt ?? '',
        cell: ({ row }) => <DateTime value={row.original.createdAt} />,
      },
    ],
    [defaultAccountId],
  )

  return (
    <>
      <PageHeader
        title="Payment accounts"
        description="Company UPI accounts members pay into. Archiving hides an account from new assignments; existing assignments are unchanged."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Add UPI account
          </Button>
        }
      />
      <DataTable
        label="Payment accounts"
        columns={columns}
        data={q.data}
        getRowId={(a) => a.id ?? ''}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        onRefresh={() => void q.refetch()}
        paging={{ mode: 'client' }}
        emptyTitle={status === 'ACTIVE' ? 'No active accounts' : 'No archived accounts'}
        rowActions={(a) => [
          {
            label: 'Archive',
            destructive: true,
            hidden: a.status !== 'ACTIVE',
            onSelect: async () => {
              const ok = await confirm({
                title: 'Archive this UPI account?',
                description:
                  'It won’t be offered for new assignments. Members already assigned keep it until changed.',
                details: [
                  { label: 'UPI ID', value: a.vpa },
                  { label: 'Payee', value: a.payeeName },
                ],
                confirmLabel: 'Archive',
                destructive: true,
              })
              if (ok && a.id) await archive.mutateAsync(a.id)
            },
          },
        ]}
        toolbar={
          <Tabs
            value={status}
            onValueChange={(v) => void navigate({ search: { status: v as PaymentAccountStatus } })}
          >
            <TabsList>
              <TabsTrigger value="ACTIVE">Active</TabsTrigger>
              <TabsTrigger value="ARCHIVED">Archived</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <AddAccountDialog key={addOpen ? 'o' : 'c'} open={addOpen} onOpenChange={setAddOpen} />
    </>
  )
}

function AddAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { label: '', vpa: '', payeeName: '' },
  })
  const [qrId, setQrId] = useState<string | undefined>()
  const [uploading, setUploading] = useState(false)
  const create = useApiMutation({
    mutationFn: (v: Values) =>
      unwrap(
        apiClient.POST('/api/v1/admin/payment-accounts', {
          body: {
            label: v.label || undefined,
            vpa: v.vpa,
            payeeName: v.payeeName,
            qrDocumentId: qrId,
          },
        }),
      ),
    success: 'UPI account added',
    invalidate: [paymentAccountKeys.all],
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add UPI account</DialogTitle>
          <DialogDescription>
            Members will see this UPI ID and payee name when paying. Double-check before saving.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit(async (v) => {
              await create.mutateAsync(v)
              onOpenChange(false)
            })}
          >
            <FormField
              control={form.control}
              name="vpa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>UPI ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="alliance@okaxis"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payeeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payee name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} placeholder="e.g. HDFC current" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <Label htmlFor="pa-qr">QR image (optional)</Label>
              <DocumentUpload
                id="pa-qr"
                docType="PAYMENT_QR"
                imagesOnly
                value={qrId}
                onChange={setQrId}
                onBusyChange={setUploading}
                disabled={create.isPending}
              />
              <p className="text-muted-foreground text-xs">
                If you don’t upload one, members get a QR generated from the UPI ID.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading || create.isPending}>
                {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
