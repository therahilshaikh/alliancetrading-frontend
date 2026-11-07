# Backend gaps

UI hidden because no backend support exists yet (per ADMIN_WEB_CONTEXT.md section 9):

- Global ledger across all members
- CSV / report exports
- Admin corrections of member profile (name / DOB)
- Change-mobile approvals
- Server-side bank-change alerts and name-match checks (done client-side as a warning badge)
- TOTP / 2FA, server-side idle timeout (client-side idle logout implemented instead)

## Open

- **P&L evidence isn't returned.** `BatchResponse` has no `evidenceDocumentId`; the console no longer uploads P&L evidence, so this only matters if it comes back.
- **No per-member bank account history.** `GET /admin/bank-accounts` has no `userId` filter, so the member's Bank tab still shows only the current account and links to the Bank accounts page.
- No "log out all devices" endpoint yet, so the console has no such action.

## Resolved (backend update)

- Lists are paged server-side (newest first): investments, bank accounts, withdrawals (with an "All" tab), P&L batches (with a server-side `valueType` filter). Side panels and deep links open rows by id (`/admin/{investments|withdrawals|bank-accounts|pnl-batches}/{id}`).
- P&L preview and allocations pages load the batch header with `GET /admin/pnl-batches/{id}` instead of listing every batch.
- Admins have display names: login/refresh return the `admin` profile (greeting and account menu), `GET /admin/admin-directory` resolves admin ids to names everywhere (incl. the signed-in and disabled admins), create requires a name and `PATCH /admin/admin-users/{id}` renames.
- Overview matches the prototype: `GET /admin/dashboard` returns `stats` (with this-month / today deltas), `actionCenter` counts and `todayDistribution` (credited vs eligible).
- Payment proofs rows carry member `fullName`/`mobile` and `expectedVpa`/`expectedAmount`; bank account rows carry `fullName`/`mobile`. No per-row or per-panel member lookups remain.
- Withdrawals: `GET /admin/withdrawals` returns `AdminWithdrawalResponse` (member, bank snapshot, `bankAccountId`, approvers, `secondApprovalRequired` / `awaitingSecondApproval`, payout UTR/proof). The page shows the member, bank details with an audited account-number reveal, the real second-approval state (Second-approve is disabled for the first approver) and who approved/paid.
- Settings: `GET /admin/settings` returns current values and pending proposals with their values. The audit-log reconstruction and its warning are removed; the page has a "Current values" tab. Settings is SUPER_ADMIN only (nav + route guard).
- Admin uploads: `POST /admin/documents` is used for payout proof (mark paid), P&L evidence, and QR images (payment accounts, default payment setting).
- Bank accounts: list rows link to the member via `userId`.
- Refresh-token reuse now revokes the session (backend fix; not re-verified live from the console).
- E2E test data: `OTP_FIXED_CODE` lets Playwright create members end to end (see README).
