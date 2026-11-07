import { isBusinessProblem, type ProblemDetail } from './problem'

/** Thrown by `unwrap` for non-2xx responses; carries the RFC 7807 body. */
export class ApiError extends Error {
  readonly problem: ProblemDetail
  constructor(problem: ProblemDetail) {
    super(problem.detail ?? problem.title ?? 'Request failed')
    this.name = 'ApiError'
    this.problem = problem
  }
  get status() {
    return this.problem.status
  }
  get code() {
    return this.problem.code
  }
}

function toProblem(error: unknown, response: Response): ProblemDetail {
  if (error && typeof error === 'object') {
    return {
      ...(error as ProblemDetail),
      status: (error as ProblemDetail).status ?? response.status,
    }
  }
  return {
    status: response.status,
    detail: typeof error === 'string' && error ? error : response.statusText || 'Request failed',
  }
}

interface FetchResult<T> {
  data?: T
  error?: unknown
  response: Response
}

/** Await an openapi-fetch call; return `data` or throw an ApiError. */
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await call
  if (!response.ok) throw new ApiError(toProblem(error, response))
  return data as T
}

/**
 * Await a `parseAs: 'blob'` call (file/image endpoints). openapi-fetch types
 * these by the spec's JSON schema, so the Blob is checked here, once.
 * When the server names the file (Content-Disposition) the result is a File,
 * so callers can offer the original filename for downloads.
 */
export async function unwrapBlob(call: Promise<FetchResult<unknown>>): Promise<Blob> {
  const { data, error, response } = await call
  if (!response.ok) throw new ApiError(toProblem(error, response))
  if (!(data instanceof Blob))
    throw new ApiError({ status: response.status, detail: 'Empty file response' })
  const filename = filenameFromDisposition(response.headers.get('Content-Disposition'))
  return filename ? new File([data], filename, { type: data.type }) : data
}

/**
 * Filename from a Content-Disposition header (RFC 6266): `filename*=UTF-8''…`
 * first, then a plain `filename="…"`. The plain form is ignored when it holds
 * an RFC 2047 encoded-word (`=?UTF-8?Q?…?=`), which some servers send as the
 * ASCII fallback for non-ASCII names.
 */
export function filenameFromDisposition(header: string | null | undefined): string | undefined {
  if (!header) return undefined
  const extended = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header)
  if (extended?.[2]) {
    try {
      const name = decodeURIComponent(extended[2].trim().replace(/^"|"$/g, ''))
      if (name) return safeName(name)
    } catch {
      // Malformed percent-encoding: fall through to the plain form.
    }
  }
  const plain = /filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]+))/i.exec(header)
  const value = (plain?.[1] ?? plain?.[2])?.trim().replace(/\\(.)/g, '$1')
  if (!value || /^=\?.*\?=$/.test(value)) return undefined
  return safeName(value)
}

/** Keep only the last path segment, so a name can never point at a folder. */
function safeName(name: string): string | undefined {
  const base = name.split(/[\\/]/).pop()?.trim()
  return base || undefined
}

/** Headers for money-moving POSTs. Generate once per user action. */
export function idempotencyHeaders(): { 'Idempotency-Key': string } {
  return { 'Idempotency-Key': crypto.randomUUID() }
}

/** Operator-facing message for an error (no stack traces, no PII). */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (!(err instanceof ApiError)) return fallback
  const p = err.problem
  if (isBusinessProblem(p) || p.status === 409 || p.status === 422 || p.status === 400) {
    return p.detail ?? p.title ?? fallback
  }
  if (p.status === 403) return "You don't have permission to do this."
  if (p.status === 404) return 'Not found. It may have been changed by someone else.'
  if (p.status === 401) return 'Your session ended, please sign in again.'
  if (p.status === 429) return p.detail ?? 'Too many attempts. Try again later.'
  if (p.status && p.status >= 500) return 'Server error. Please try again.'
  return p.detail ?? fallback
}

export function errorRequestId(err: unknown): string | undefined {
  return err instanceof ApiError ? err.problem.requestId : undefined
}
