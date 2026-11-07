import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { idempotencyHeaders, unwrap } from '@/api/http'
import type { components } from '@/api/schema'
import { useApiMutation } from '@/lib/mutations'
import { pagedQueryOptions } from '@/lib/query'
import { dashboardKeys } from '@/features/dashboard/api'
import type { PnlBatchRequest } from './schemas'

export type Batch = components['schemas']['BatchResponse']
export type BatchStatus = NonNullable<Batch['status']>
export type Preview = components['schemas']['PreviewResult']
export type Allocation = components['schemas']['AllocationResponse']
export type Approver = components['schemas']['ApproverOption']

export const pnlKeys = {
  all: ['pnl'] as const,
  list: (q: BatchListQuery) => ['pnl', 'list', q] as const,
  detail: (id: string) => ['pnl', 'detail', id] as const,
  approvers: ['pnl', 'approvers'] as const,
  preview: (id: string) => ['pnl', 'preview', id] as const,
  allocations: (id: string) => ['pnl', 'allocations', id] as const,
}

export interface BatchListQuery {
  status?: BatchStatus
  valueType?: 'FIXED' | 'PERCENTAGE'
  assignedToMe?: boolean
  page: number
  size: number
}

/** Paged, newest first. */
export function useBatches(q: BatchListQuery) {
  return useQuery({
    queryKey: pnlKeys.list(q),
    queryFn: () => unwrap(apiClient.GET('/api/v1/admin/pnl-batches', { params: { query: q } })),
    ...pagedQueryOptions({
      status: q.status,
      valueType: q.valueType,
      assignedToMe: q.assignedToMe,
    }),
  })
}

/** Batch header by id (preview / allocations pages). */
export function useBatch(id: string) {
  return useQuery({
    queryKey: pnlKeys.detail(id),
    queryFn: () =>
      unwrap(apiClient.GET('/api/v1/admin/pnl-batches/{id}', { params: { path: { id } } })),
  })
}

export function useApprovers() {
  return useQuery({
    queryKey: pnlKeys.approvers,
    queryFn: () => unwrap(apiClient.GET('/api/v1/admin/pnl-batches/approvers')),
    staleTime: 5 * 60_000,
  })
}

/** Always fresh: the approver must review the current preview before approving. */
export function usePreview(id: string) {
  return useQuery({
    queryKey: pnlKeys.preview(id),
    queryFn: () =>
      unwrap(apiClient.GET('/api/v1/admin/pnl-batches/{id}/preview', { params: { path: { id } } })),
    staleTime: 0,
    gcTime: 0,
  })
}

export function useAllocations(id: string) {
  return useQuery({
    queryKey: pnlKeys.allocations(id),
    queryFn: () =>
      unwrap(
        apiClient.GET('/api/v1/admin/pnl-batches/{id}/allocations', { params: { path: { id } } }),
      ),
  })
}

const invalidate = [pnlKeys.all, dashboardKeys.all, ['members']]

/**
 * Dry run of a batch that isn't saved yet (POST /pnl-batches/preview). Returns the
 * server's total, per-investment amounts and warnings; a loss-floor breach is an error.
 */
export function useDraftPreview(body: PnlBatchRequest | null) {
  return useQuery({
    queryKey: ['pnl', 'draft-preview', body] as const,
    queryFn: () => unwrap(apiClient.POST('/api/v1/admin/pnl-batches/preview', { body: body! })),
    enabled: body !== null,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  })
}

export function useCreateBatch() {
  return useApiMutation({
    mutationFn: (body: PnlBatchRequest) =>
      unwrap(apiClient.POST('/api/v1/admin/pnl-batches', { body, headers: idempotencyHeaders() })),
    success: 'P&L batch created and sent to the approver',
    invalidate,
  })
}

export function useApproveBatch() {
  return useApiMutation({
    mutationFn: (id: string) =>
      unwrap(
        apiClient.POST('/api/v1/admin/pnl-batches/{id}/approve', {
          params: { path: { id } },
          headers: idempotencyHeaders(),
        }),
      ),
    success: 'Batch approved. P&L posted to members.',
    invalidate,
  })
}

export function useRejectBatch() {
  return useApiMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      unwrap(
        apiClient.POST('/api/v1/admin/pnl-batches/{id}/reject', {
          params: { path: { id } },
          body: { reason },
        }),
      ),
    success: 'Batch rejected',
    invalidate,
  })
}
