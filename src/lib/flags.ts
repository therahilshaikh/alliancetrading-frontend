/**
 * Build-time feature flags read from env (no backend call). One-directional:
 * once a flag ships as true, don't flip it back.
 *
 * These gate UI visibility only — the backend already permits everything.
 */

const on = (v: string | undefined) => v === 'true' || v === '1'

/** Multiple ACTIVE investment tranches per member (top-up, tranche list/detail). */
export const MULTI_INVESTMENT_ENABLED = on(
  import.meta.env.VITE_MULTI_INVESTMENT_ENABLED as string | undefined,
)

/** Partial principal withdrawal amount input + per-tranche remaining principal. */
export const PARTIAL_PRINCIPAL_WITHDRAWAL_ENABLED = on(
  import.meta.env.VITE_PARTIAL_PRINCIPAL_WITHDRAWAL_ENABLED as string | undefined,
)
