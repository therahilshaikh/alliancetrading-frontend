import { useMemo, useState, type FormEvent } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, Loader2, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { DataTable } from '@/components/shared/data-table'
import { DateTime } from '@/components/shared/format'
import { ErrorState, PageHeader } from '@/components/shared/layout'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import {
  useReopen,
  useReply,
  useResolve,
  useSetPriority,
  useThread,
  useTickets,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from '../api'

const route = getRouteApi('/app/support')
const ALL = 'ALL'

export function SupportPage() {
  const { status, priority, page, size, id } = route.useSearch()
  const navigate = route.useNavigate()
  const q = useTickets({ status, priority, page, size })

  const columns = useMemo<ColumnDef<Ticket, unknown>[]>(
    () => [
      {
        id: 'subject',
        header: 'Subject',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-bold">{row.original.subject}</p>
            <p className="text-muted-foreground text-xs">
              {row.original.userName ?? 'Member'} · {row.original.userMobile}
            </p>
          </div>
        ),
      },
      {
        id: 'priority',
        header: 'Priority',
        cell: ({ row }) => <StatusBadge status={row.original.priority} />,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'last',
        header: 'Last message',
        cell: ({ row }) => (
          <DateTime value={row.original.lastMessageAt ?? row.original.createdAt} />
        ),
      },
    ],
    [],
  )

  return (
    <>
      <PageHeader
        title="Support"
        description="Reply to member questions. High priority tickets are flagged for quick handling."
      />
      <DataTable
        label="Support tickets"
        columns={columns}
        data={q.data?.items}
        getRowId={(t) => t.id ?? ''}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        onRefresh={() => void q.refetch()}
        onRowClick={(t) => void navigate({ search: (s) => ({ ...s, id: t.id }) })}
        emptyTitle="No tickets match"
        toolbar={
          <>
            <Select
              value={status ?? ALL}
              onValueChange={(v) =>
                void navigate({
                  search: (s) => ({
                    ...s,
                    status: v === ALL ? undefined : (v as TicketStatus),
                    page: 0,
                  }),
                })
              }
            >
              <SelectTrigger className="h-9 w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={priority ?? ALL}
              onValueChange={(v) =>
                void navigate({
                  search: (s) => ({
                    ...s,
                    priority: v === ALL ? undefined : (v as TicketPriority),
                    page: 0,
                  }),
                })
              }
            >
              <SelectTrigger className="h-9 w-36" aria-label="Filter by priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All priorities</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        paging={{
          mode: 'server',
          page: q.data?.page ?? page,
          size: q.data?.size ?? size,
          totalItems: q.data?.totalItems ?? 0,
          totalPages: q.data?.totalPages ?? 0,
          onPageChange: (p) => void navigate({ search: (s) => ({ ...s, page: p }) }),
          onSizeChange: (sz) => void navigate({ search: (s) => ({ ...s, size: sz, page: 0 }) }),
        }}
      />
      <ThreadSheet
        key={id}
        ticketId={id}
        onClose={() => void navigate({ search: (s) => ({ ...s, id: undefined }) })}
      />
    </>
  )
}

function ThreadSheet({ ticketId, onClose }: { ticketId: string | undefined; onClose: () => void }) {
  const thread = useThread(ticketId)
  const reply = useReply()
  const resolve = useResolve()
  const reopen = useReopen()
  const setPriority = useSetPriority()
  const [text, setText] = useState('')
  const t = thread.data?.ticket
  const open = t?.status === 'OPEN'

  async function onSend(e: FormEvent) {
    e.preventDefault()
    const message = text.trim()
    if (!ticketId || !message) return
    await reply.mutateAsync({ ticketId, message })
    setText('')
  }

  return (
    <Sheet open={!!ticketId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-lg font-extrabold">{t?.subject ?? 'Ticket'}</SheetTitle>
            <StatusBadge status={t?.status} />
          </div>
          <SheetDescription asChild>
            <div>
              {t?.userId ? (
                <Link
                  to="/members/$userId"
                  params={{ userId: t.userId }}
                  className="font-semibold hover:underline"
                >
                  {t.userName ?? 'Member'}
                </Link>
              ) : null}{' '}
              · {t?.userMobile} · opened <DateTime value={t?.createdAt} />
            </div>
          </SheetDescription>
        </SheetHeader>

        {t?.id ? (
          <div className="flex flex-wrap items-center gap-2 px-4">
            <Label htmlFor="prio" className="text-xs">
              Priority
            </Label>
            <Select
              value={t.priority}
              onValueChange={(v) =>
                void setPriority.mutateAsync({ ticketId: t.id!, priority: v as TicketPriority })
              }
              disabled={setPriority.isPending}
            >
              <SelectTrigger id="prio" className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto">
              {open ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void resolve.mutateAsync(t.id!)}
                  disabled={resolve.isPending}
                >
                  <CheckCircle2 className="size-4" /> Resolve
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void reopen.mutateAsync(t.id!)}
                  disabled={reopen.isPending}
                >
                  <RotateCcw className="size-4" /> Reopen
                </Button>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto px-4" aria-live="polite">
          {thread.isLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : thread.error ? (
            <ErrorState error={thread.error} onRetry={() => void thread.refetch()} />
          ) : (
            (thread.data?.messages ?? []).map((m) => (
              <div
                key={m.id}
                className={cn('flex', m.authorType === 'ADMIN' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                    m.authorType === 'ADMIN'
                      ? 'bg-brand text-white'
                      : 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-slate-100',
                  )}
                >
                  {/* Plain text only: React escapes the string; whitespace preserved via CSS. */}
                  <p className="break-words whitespace-pre-wrap">{m.body}</p>
                  <p
                    className={cn(
                      'mt-1 text-[10px]',
                      m.authorType === 'ADMIN' ? 'text-white/70' : 'text-muted-foreground',
                    )}
                  >
                    {m.authorType === 'ADMIN' ? 'Admin' : 'Member'} ·{' '}
                    <DateTime value={m.createdAt} />
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {t?.id ? (
          <form onSubmit={onSend} className="space-y-2 border-t p-4">
            <Label htmlFor="reply">Reply</Label>
            <Textarea
              id="reply"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={4000}
              rows={3}
              placeholder={
                open ? 'Write a reply to the member' : 'Replying reopens the conversation'
              }
            />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs tabular-nums">{text.length}/4000</span>
              <Button type="submit" disabled={!text.trim() || reply.isPending}>
                {reply.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send
              </Button>
            </div>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
