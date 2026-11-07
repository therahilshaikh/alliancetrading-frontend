import { describe, expect, it } from 'vitest'
import {
  ApiError,
  errorMessage,
  errorRequestId,
  filenameFromDisposition,
  unwrap,
  unwrapBlob,
} from './http'

const res = (status: number) => new Response(null, { status })

describe('unwrap / ApiError', () => {
  it('returns data for 2xx', async () => {
    await expect(unwrap(Promise.resolve({ data: { ok: 1 }, response: res(200) }))).resolves.toEqual(
      { ok: 1 },
    )
  })

  it('throws ApiError carrying the problem body for non-2xx', async () => {
    const problem = {
      code: 'MAKER_CHECKER_VIOLATION',
      detail: 'Approver must differ from maker',
      requestId: 'req-1',
      status: 409,
    }
    const err = await unwrap(Promise.resolve({ error: problem, response: res(409) })).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('MAKER_CHECKER_VIOLATION')
  })
})

describe('errorMessage', () => {
  const make = (p: object) => new ApiError(p)

  it('shows operator-facing detail for business codes', () => {
    expect(
      errorMessage(
        make({
          code: 'ILLEGAL_STATE_TRANSITION',
          status: 409,
          detail: 'Only APPROVED withdrawals can be marked paid',
        }),
      ),
    ).toBe('Only APPROVED withdrawals can be marked paid')
  })

  it('uses safe generic messages for 403, 404 and 5xx', () => {
    expect(errorMessage(make({ status: 403, detail: 'stack trace…' }))).toMatch(/permission/)
    expect(errorMessage(make({ status: 404 }))).toMatch(/Not found/)
    expect(errorMessage(make({ status: 500, detail: 'NullPointerException' }))).toMatch(
      /Server error/,
    )
  })

  it('exposes the requestId for tracing and falls back for unknown errors', () => {
    expect(errorRequestId(make({ requestId: 'abc' }))).toBe('abc')
    expect(errorMessage(new Error('boom'))).toBe('Something went wrong')
    expect(errorRequestId(new Error('boom'))).toBeUndefined()
  })
})

describe('filenameFromDisposition', () => {
  it('prefers the RFC 5987 filename* and decodes it', () => {
    // Exact header the backend sends for a non-ASCII name.
    const header = `inline; filename="=?UTF-8?Q?HDFC_statement_=E2=80=93_Oct_2026_=E2=82=B9.png?="; filename*=UTF-8''HDFC%20statement%20%E2%80%93%20Oct%202026%20%E2%82%B9.png`
    expect(filenameFromDisposition(header)).toBe('HDFC statement – Oct 2026 ₹.png')
  })
  it('falls back to a plain quoted or bare filename', () => {
    expect(filenameFromDisposition('inline; filename="bank proof.pdf"')).toBe('bank proof.pdf')
    expect(filenameFromDisposition('attachment; filename=proof.png')).toBe('proof.png')
  })
  it('ignores an RFC 2047 encoded-word fallback and malformed values', () => {
    expect(filenameFromDisposition('inline; filename="=?UTF-8?Q?a=E2=82=B9.png?="')).toBeUndefined()
    expect(filenameFromDisposition("inline; filename*=UTF-8''%E2%82")).toBeUndefined()
    expect(filenameFromDisposition('inline')).toBeUndefined()
    expect(filenameFromDisposition(null)).toBeUndefined()
  })
  it('never returns a path', () => {
    expect(filenameFromDisposition('inline; filename="../../etc/passwd"')).toBe('passwd')
    expect(filenameFromDisposition("inline; filename*=UTF-8''..%5C..%5Cboot.ini")).toBe('boot.ini')
  })
})

describe('unwrapBlob', () => {
  const blobRes = (headers: Record<string, string> = {}) =>
    new Response(null, { status: 200, headers })
  it('returns a File named from Content-Disposition', async () => {
    const data = new Blob(['x'], { type: 'image/png' })
    const out = await unwrapBlob(
      Promise.resolve({
        data,
        response: blobRes({ 'Content-Disposition': 'inline; filename="proof.png"' }),
      }),
    )
    expect(out).toBeInstanceOf(File)
    expect((out as File).name).toBe('proof.png')
    expect(out.type).toBe('image/png')
  })
  it('returns the plain Blob when no filename is sent', async () => {
    const data = new Blob(['x'], { type: 'image/png' })
    const out = await unwrapBlob(Promise.resolve({ data, response: blobRes() }))
    expect(out).not.toBeInstanceOf(File)
  })
})
