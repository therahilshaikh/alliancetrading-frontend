import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { unwrap } from '@/api/http'
import type { components } from '@/api/schema'
import { useApiMutation } from '@/lib/mutations'
import { pagedQueryOptions } from '@/lib/query'
import { dashboardKeys } from '@/features/dashboard/api'

export type Ticket = components['schemas']['TicketSummary']
export type TicketStatus = NonNullable<Ticket['status']>
export type TicketPriority = NonNullable<Ticket['priority']>
export type Thread = components['schemas']['ThreadView']

export const supportKeys = {
  all: ['support'] as const,
  list: (q: { status?: TicketStatus; priority?: TicketPriority; page: number; size: number }) =>
    ['support', 'list', q] as const,
  thread: (id: string) => ['support', 'thread', id] as const,
}

export function useTickets(q: {
  status?: TicketStatus
  priority?: TicketPriority
  page: number
  size: number
}) {
  return useQuery({
    queryKey: supportKeys.list(q),
    queryFn: () => unwrap(apiClient.GET('/api/v1/admin/support/tickets', { params: { query: q } })),
    ...pagedQueryOptions({ status: q.status, priority: q.priority }),
  })
}

export function useThread(ticketId: string | undefined) {
  return useQuery({
    queryKey: supportKeys.thread(ticketId ?? ''),
    queryFn: () =>
      unwrap(
        apiClient.GET('/api/v1/admin/support/tickets/{ticketId}', {
          params: { path: { ticketId: ticketId! } },
        }),
      ),
    enabled: !!ticketId,
    refetchInterval: 30_000,
  })
}

const invalidate = [supportKeys.all, dashboardKeys.all]
const path = (ticketId: string) => ({ params: { path: { ticketId } } })

export function useReply() {
  return useApiMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/support/tickets/{ticketId}/messages', {
          ...path(ticketId),
          body: { message },
        }),
      ),
    success: 'Reply sent',
    invalidate,
  })
}

export function useResolve() {
  return useApiMutation({
    mutationFn: (ticketId: string) =>
      unwrap(apiClient.POST('/api/v1/admin/support/tickets/{ticketId}/resolve', path(ticketId))),
    success: 'Ticket resolved',
    invalidate,
  })
}

export function useReopen() {
  return useApiMutation({
    mutationFn: (ticketId: string) =>
      unwrap(apiClient.POST('/api/v1/admin/support/tickets/{ticketId}/reopen', path(ticketId))),
    success: 'Ticket reopened',
    invalidate,
  })
}

export function useSetPriority() {
  return useApiMutation({
    mutationFn: ({ ticketId, priority }: { ticketId: string; priority: TicketPriority }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/support/tickets/{ticketId}/priority', {
          ...path(ticketId),
          body: { priority },
        }),
      ),
    success: 'Priority updated',
    invalidate,
  })
}
