import { toast } from 'sonner'
import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from '@tanstack/react-query'
import { errorMessage, errorRequestId } from '@/api/http'

/** Error toast: operator message + requestId so it can be traced in logs. */
export interface ToastAction {
  label: string
  onClick: () => void
}

export function toastError(err: unknown, fallback?: string, action?: ToastAction) {
  const requestId = errorRequestId(err)
  toast.error(errorMessage(err, fallback), {
    description: requestId ? `Reference: ${requestId}` : undefined,
    action,
  })
}

interface ApiMutationOptions<TData, TVars> extends Omit<
  UseMutationOptions<TData, Error, TVars>,
  'onError'
> {
  /** Success toast text (string or derived from the variables/result). */
  success?: string | ((data: TData, vars: TVars) => string)
  /** Query keys to invalidate after success. */
  invalidate?: QueryKey[]
  /** Optional button on the error toast, e.g. a link to where the problem can be fixed. */
  errorAction?: (err: Error) => ToastAction | undefined
}

/**
 * useMutation with the console's standard behaviour: error toast with
 * requestId, optional success toast, and query invalidation on success.
 *
 * Invalidation runs in the background: the action is done once the server
 * confirms it, so buttons stop spinning with the success toast instead of
 * waiting for every affected list to refetch (tables show their own
 * refreshing state meanwhile).
 */
export function useApiMutation<TData = unknown, TVars = void>({
  success,
  invalidate,
  errorAction,
  onSuccess,
  ...options
}: ApiMutationOptions<TData, TVars>) {
  const queryClient = useQueryClient()
  return useMutation<TData, Error, TVars>({
    ...options,
    onError: (err) => toastError(err, undefined, errorAction?.(err)),
    onSuccess: async (data, vars, ...rest) => {
      if (success) toast.success(typeof success === 'function' ? success(data, vars) : success)
      for (const queryKey of invalidate ?? []) void queryClient.invalidateQueries({ queryKey })
      await onSuccess?.(data, vars, ...rest)
    },
  })
}
