/**
 * E2E seeding through the real backend API (no DB access, no mocks).
 * Start the backend with OTP_FIXED_CODE=123456 so every member OTP is known.
 */
import { randomUUID } from 'node:crypto'

export const API = process.env.E2E_API_URL ?? 'http://localhost:8080'
export const OTP = process.env.E2E_OTP ?? '123456'

export const ADMINS = {
  super: { email: 'super@alliancetrading.local', password: 'SuperSecure1!' },
  admin: { email: 'admin@alliancetrading.local', password: 'AdminSecure1!' },
} as const
type Json = Record<string, unknown>

async function call<T>(method: string, path: string, opts: { token?: string; body?: unknown; form?: FormData; idem?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.idem) headers['Idempotency-Key'] = randomUUID()
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`)
  return (text ? JSON.parse(text) : undefined) as T
}

export async function adminToken(who: keyof typeof ADMINS): Promise<string> {
  const r = await call<{ accessToken: string }>('POST', '/admin/auth/login', { body: ADMINS[who] })
  return r.accessToken
}

const rand = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')
const letters = (n: number) => Array.from({ length: n }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('')

/** 1×1 PNG, enough for proof uploads. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

// Verhoeff tables: the backend validates the Aadhaar checksum digit.
const VD = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const VP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]
const VINV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]

export function verhoeffCheckDigit(digits: string): number {
  let c = 0
  const rev = digits.split('').reverse().map(Number)
  rev.forEach((d, i) => {
    c = VD[c]![VP[(i + 1) % 8]![d]!]!
  })
  return VINV[c]!
}

/** 12-digit Aadhaar (first digit 2–9) with a valid Verhoeff check digit. */
export function randomAadhaar(): string {
  const body = `${2 + Math.floor(Math.random() * 8)}${rand(10)}`
  return body + verhoeffCheckDigit(body)
}
export interface Member {
  mobile: string
  fullName: string
  token: string
  userId?: string
}

/** Register a member via OTP and submit KYC + bank account → status KYC_SUBMITTED. */
export async function seedKycSubmittedMember(): Promise<Member> {
  const mobile = `9${rand(9)}`
  const fullName = `E2E Member ${letters(4)}`
  await call('POST', '/auth/otp/request', { body: { mobile } })
  const auth = await call<{ accessToken: string }>('POST', '/auth/otp/verify', {
    body: { mobile, otp: OTP, deviceId: `e2e-${randomUUID()}`, deviceInfo: 'playwright' },
  })
  const token = auth.accessToken

  await call('POST', '/kyc', { token, body: { fullName, dob: '1990-05-17', pan: `${letters(5)}${rand(4)}${letters(1)}`, aadhaar: randomAadhaar() } })
  const proof = await upload(token, 'BANK_PROOF')
  await call('POST', '/bank-accounts', {
    token,
    body: { holderName: fullName, accountNumber: `5${rand(11)}`, ifsc: 'HDFC0001234', accountType: 'SAVINGS', vpa: `e2e${rand(6)}@okhdfc`, proofDocumentId: proof },
  })
  const me = await call<{ userId?: string }>('GET', '/me/profile', { token })
  return { mobile, fullName, token, userId: me.userId }
}

async function upload(token: string, docType: string): Promise<string> {
  const form = new FormData()
  form.append('file', new Blob([PNG], { type: 'image/png' }), `${docType.toLowerCase()}.png`)
  const doc = await call<{ id: string }>('POST', `/files?docType=${docType}`, { token, form })
  return doc.id
}

/** An active company UPI account (creates one if the list is empty). */
export async function ensurePaymentAccount(adminTok: string): Promise<{ id: string; vpa: string }> {
  const list = await call<{ id: string; vpa: string }[]>('GET', '/admin/payment-accounts?status=ACTIVE', { token: adminTok })
  if (list.length) return list[0]!
  return call('POST', '/admin/payment-accounts', { token: adminTok, body: { label: 'E2E', vpa: 'alliance.e2e@okaxis', payeeName: 'AllianceTrading' } })
}

/** KYC-approved member with an ACTIVE investment (payment proof approved). */
export async function seedActiveInvestor(): Promise<Member & { investmentId: string }> {
  const m = await seedKycSubmittedMember()
  const sup = await adminToken('super')
  const pa = await ensurePaymentAccount(sup)
  await call('POST', `/admin/users/${m.userId}/kyc/approve`, { token: sup, idem: true, body: { payment: { paymentAccountId: pa.id, amount: 50000 } } })
  const proof = await upload(m.token, 'PAYMENT_PROOF')
  const inv = await call<{ id: string }>('POST', '/investments', { token: m.token, idem: true, body: { proofDocumentId: proof } })
  await call('POST', `/admin/investments/${inv.id}/approve`, { token: sup, idem: true, body: {} })
  return { ...m, investmentId: inv.id }
}

/** Post and approve a +percentage P&L for one investment (maker = super, checker = admin). */
export async function postProfit(investmentId: string, percentage: number, sessionDate: string) {
  const sup = await adminToken('super')
  const adm = await adminToken('admin')
  const approvers = await call<{ id: string; email: string }[]>('GET', '/admin/pnl-batches/approvers', { token: sup })
  const checker = approvers.find((a) => a.email === ADMINS.admin.email)
  if (!checker) throw new Error('admin@ is not in the approvers list')
  const batch = await call<{ id: string }>('POST', '/admin/pnl-batches', {
    token: sup,
    idem: true,
    body: { sessionDate, valueType: 'PERCENTAGE', approverAdminId: checker.id, lines: [{ targetType: 'INVESTMENT', investmentId, percentage }] },
  })
  await call('POST', `/admin/pnl-batches/${batch.id}/approve`, { token: adm, idem: true })
}

/** Member requests a PROFIT withdrawal → REQUESTED. */
export async function requestProfitWithdrawal(m: Member, amount: number): Promise<string> {
  const quote = await call<{ quoteId: string }>('POST', '/withdrawals/quote', { token: m.token, body: { amount, withdrawalType: 'PROFIT' } })
  const w = await call<{ id: string }>('POST', '/withdrawals', { token: m.token, idem: true, body: { quoteId: quote.quoteId } })
  return w.id
}

export async function getJson<T = Json>(path: string, token: string): Promise<T> {
  return call<T>('GET', path, { token })
}

/** Today in IST as YYYY-MM-DD (P&L session date). */
export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}
