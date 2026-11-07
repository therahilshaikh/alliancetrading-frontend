export interface ProblemDetail {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  requestId?: string
}

const FALLBACK: ProblemDetail = { code: 'UNKNOWN', detail: 'Something went wrong' }

export async function parseProblem(res: Response): Promise<ProblemDetail> {
  try {
    const body = (await res.json()) as ProblemDetail
    return { ...FALLBACK, ...body, status: body.status ?? res.status }
  } catch {
    return { ...FALLBACK, status: res.status, detail: res.statusText || FALLBACK.detail }
  }
}

export function problemMessage(p: ProblemDetail): string {
  const detail = p.detail || p.title || 'Something went wrong'
  return p.requestId ? `${detail} (ref ${p.requestId})` : detail
}

/** Business codes whose `detail` is written for operators and safe to show. */
const SHOW_DETAIL_CODES = new Set([
  'VALIDATION_FAILED',
  'ILLEGAL_STATE_TRANSITION',
  'MAKER_CHECKER_VIOLATION',
  'INVALID_APPROVER',
  'NO_PAYMENT_ASSIGNMENT',
  'ACCOUNT_LOCKED',
  'UNAUTHENTICATED',
  'INSUFFICIENT_BALANCE',
  'INSUFFICIENT_WITHDRAWABLE',
  'FEATURE_DISABLED',
  'DUPLICATE_POSTING',
  'GUARDRAIL_VIOLATION',
])

export function isBusinessProblem(p: ProblemDetail): boolean {
  return !!p.code && SHOW_DETAIL_CODES.has(p.code)
}
