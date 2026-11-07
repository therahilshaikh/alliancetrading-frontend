# AllianceTrading Admin Console

Web admin console for AllianceTrading. Design source: Figma Make prototype (`TestAnis-main/src/AdminDashboard.tsx`, `index.css`). Source of truth: `ADMIN_WEB_CONTEXT.md`.

## Setup

```bash
npm install
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:8080
npm run gen:api        # regenerate src/api/schema.d.ts from the live backend
npm run dev
```

Backend must be running at `VITE_API_BASE_URL` (Swagger: `/swagger-ui/index.html`). In dev, Vite proxies `/api` to the backend so no CORS is needed. For non-proxy deployments the backend must list the console origin in `CORS_ALLOWED_ORIGINS` (allowed headers: `Authorization`, `Content-Type`, `Idempotency-Key`, `X-Request-Id`).

Seeded local admins: `super@alliancetrading.local` / `SuperSecure1!` (SUPER_ADMIN), `admin@alliancetrading.local` / `AdminSecure1!` (ADMIN).

## Scripts

| Script | Purpose |
|---|---|
| `dev` | Vite dev server (proxies `/api`) |
| `build` / `preview` | Production build / preview |
| `lint` / `format` | ESLint / Prettier |
| `typecheck` | `tsc -b --noEmit` (strict) |
| `test` | Vitest + RTL + msw |
| `e2e` | Playwright against the real local backend |
| `gen:api` | Regenerate OpenAPI types |

## Stack

React 19 + Vite + TS strict, Tailwind v4, shadcn/ui (new-york/slate), TanStack Router + Query + Table, react-hook-form + zod, openapi-fetch + generated types, sonner, recharts, react-day-picker, date-fns (IST display), react-number-format, react-dropzone + papaparse, react-pdf + yet-another-react-lightbox, react-idle-timer, Vitest + msw + Playwright.

## Folder structure

```
src/
  app/          router, providers (QueryClient, Theme, Auth), root layout, error boundary
  api/          schema.d.ts (generated), client.ts, auth/ (token store, refresh, broadcast), problem.ts
  features/     one folder per console area: api.ts (hooks), pages/, components/, schemas.ts
  components/   ui/ (shadcn), shared/ (DataTable, Money, DateTime, StatusBadge, PiiReveal, ...)
  lib/          format.ts (INR money, IST datetime, plain date), utils.ts, constants.ts
```

## Auth design

- Access token (JWT, 30 min) in **memory only**; refresh token (30 d) in **sessionStorage**. Never localStorage/cookies/logs. The login/refresh `expiresAt` is the **refresh** token's expiry; the access-token expiry is read from the JWT `exp`.
- openapi-fetch middleware attaches `Authorization: Bearer` and `X-Request-Id`, performs **single-flight refresh** (`POST /api/v1/auth/refresh`) ~60 s before the JWT `exp` and on 401 `TOKEN_EXPIRED`/`UNAUTHENTICATED`, and retries queued requests once.
- **Tabs share one session per browser:** Web Locks (`navigator.locks`) + `BroadcastChannel('auth')` so only one tab refreshes and new tokens reach every tab; a newly opened tab asks open tabs for the session before showing the login page.
- **Multiple devices allowed:** each device/browser has its own session; logging in elsewhere doesn't affect this one, and logout ends only the current session.
- `401 SESSION_REPLACED` (server-side revocation or refresh-token reuse) or a refused refresh: no retry, all tabs of this browser clear, login shows "Your session ended, please sign in again".
- Idle logout after 30 min (2 min warning) via react-idle-timer.
- The signed-in admin's profile (`id`, `email`, `displayName`, `role`) comes from the login/refresh response and lives in memory with the access token; it is shared with other tabs alongside the tokens. `role` only hides/shows UI; the server enforces permissions. The JWT is only read for its `exp`.

## E2E tests (Playwright)

Run against the **real local backend** with the seeded admins. Chromium must be allowed on the machine (`npx playwright install chromium` once).

```bash
# 1. Start the backend with a fixed member OTP (local/dev only; refused with real SMS)
cd c:\dev\alliancetrading
OTP_FIXED_CODE=123456 ./mvnw spring-boot:run
# PowerShell: $env:OTP_FIXED_CODE='123456'; ./mvnw spring-boot:run

# 2. In this repo
npm run e2e
```

| Spec | Flow | Seeds (via API) |
|---|---|---|
| `01-approve-kyc` | login → approve KYC with a saved payment account | member via OTP + KYC + bank account |
| `02-pnl-maker-checker` | super posts +1% PERCENTAGE to ALL, picks admin → admin opens preview → approves | active investor |
| `03-withdrawal` | approve → mark paid (₹500, below the second-approval threshold) | active investor, +2% P&L, profit withdrawal |
| `04-sessions` | multi-device login; shared tab session + logout in all tabs; `SESSION_REPLACED` → login message | none |

Each seeded member uses a fresh mobile (`9` + 9 random digits) and an Aadhaar with a valid Verhoeff check digit. The backend allows 3 OTP requests per mobile per 15 min and 20 per IP per hour; if repeated runs hit the IP limit, restart the backend (the limiter is in memory). Each run adds members to the local DB. Override defaults with `E2E_API_URL` / `E2E_OTP`.

## Adding a page

1. Create `src/features/<area>/{api.ts,schemas.ts,pages/,components/}`.
2. Write query/mutation hooks in `api.ts` using the generated types and `apiClient`.
3. Add a route in `src/app/router.tsx` (search params validated with zod) and a nav entry in the sidebar.
4. Money/destructive actions go through `useConfirm()`; mutations send `Idempotency-Key` and invalidate queries.

See `BACKEND_GAPS.md` for UI hidden due to missing endpoints — never invent endpoints.
