/** UPI VPA rule, copied from the backend's PaymentAccountRequest.vpa pattern. */
export const VPA_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/

/** Case/space-insensitive name comparison (bank holder vs KYC name). */
export function normalizeName(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true // nothing to compare → don't flag
  return normalizeName(a).replace(/ /g, '') === normalizeName(b).replace(/ /g, '')
}
