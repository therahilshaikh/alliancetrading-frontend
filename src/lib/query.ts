/**
 * Options for paged list queries. While paging within the same filters the
 * current rows stay on screen (no flash); when the filters change (tab, status,
 * search) the previous rows are dropped so the table shows its loading skeleton
 * instead of another tab's data.
 */
export function pagedQueryOptions(filters: object) {
  const pageFilters = JSON.stringify(filters)
  return {
    meta: { pageFilters },
    placeholderData: <T,>(previous: T | undefined, previousQuery?: { meta?: Record<string, unknown> }) =>
      previousQuery?.meta?.pageFilters === pageFilters ? previous : undefined,
  }
}
