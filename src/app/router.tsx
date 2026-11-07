import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { LoginPage } from '@/features/auth/login-page'
import { EmptyState } from '@/components/shared/layout'
import { Button } from '@/components/ui/button'
import { AppShell } from './shell'
import { AppErrorBoundary } from './error-boundary'
import { RequireRole } from './require-role'

export interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <AppErrorBoundary>
      <Outlet />
    </AppErrorBoundary>
  ),
  notFoundComponent: () => (
    <EmptyState
      title="Page not found"
      description="The link may be out of date."
      action={
        <Button asChild>
          <Link to="/">Go to overview</Link>
        </Button>
      }
    />
  ),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: z.object({ reason: z.enum(['expired']).optional() }),
  component: LoginPage,
})

// Auth gating lives in AppShell: a new tab may receive the shared session from
// another tab asynchronously, so we can't decide synchronously here.
const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: AppShell,
})

// Feature pages are code-split; each loads on first visit (or on hover via preload).
const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/features/dashboard/pages/dashboard-page'), 'DashboardPage'),
})

const pageSearch = {
  page: z.number().int().min(0).catch(0).default(0),
  size: z.number().int().min(1).max(100).catch(20).default(20),
}

const approvalsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/approvals',
  validateSearch: z.object({
    status: z.enum(['KYC_SUBMITTED', 'APPROVED', 'REJECTED']).catch('KYC_SUBMITTED').default('KYC_SUBMITTED'),
    ...pageSearch,
    userId: z.string().uuid().optional().catch(undefined),
  }),
  component: lazyRouteComponent(() => import('@/features/approvals/pages/approvals-page'), 'ApprovalsPage'),
})

const paymentsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/payments',
  validateSearch: z.object({
    status: z
      .enum(['PENDING_VERIFICATION', 'ACTIVE', 'REJECTED', 'CLOSED'])
      .catch('PENDING_VERIFICATION')
      .default('PENDING_VERIFICATION'),
    ...pageSearch,
    id: z.string().uuid().optional().catch(undefined),
  }),
  component: lazyRouteComponent(() => import('@/features/payments/pages/payments-page'), 'PaymentsPage'),
})

const memberDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/members/$userId',
  params: {
    parse: (p) => ({ userId: z.string().uuid().parse(p.userId) }),
    stringify: (p) => ({ userId: p.userId }),
  },
  validateSearch: z.object({
    tab: z.enum(['overview', 'kyc', 'bank', 'investments', 'ledger']).catch('overview').default('overview'),
  }),
  component: lazyRouteComponent(() => import('@/features/members/pages/member-detail-page'), 'MemberDetailPage'),
})

const batchIdParam = {
  parse: (p: { batchId: string }) => ({ batchId: z.string().uuid().parse(p.batchId) }),
  stringify: (p: { batchId: string }) => ({ batchId: p.batchId }),
}

const pnlRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/pnl',
  validateSearch: z.object({
    tab: z.enum(['post', 'awaiting', 'history']).catch('post').default('post'),
    status: z.enum(['DRAFT', 'APPROVED', 'REJECTED']).optional().catch(undefined),
    type: z.enum(['FIXED', 'PERCENTAGE']).optional().catch(undefined),
    ...pageSearch,
  }),
  component: lazyRouteComponent(() => import('@/features/pnl/pages/pnl-page'), 'PnlPage'),
})

const pnlPreviewRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/pnl/$batchId/preview',
  params: batchIdParam,
  component: lazyRouteComponent(() => import('@/features/pnl/pages/preview-page'), 'PnlPreviewPage'),
})

const pnlAllocationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/pnl/$batchId/allocations',
  params: batchIdParam,
  component: lazyRouteComponent(() => import('@/features/pnl/pages/allocations-page'), 'PnlAllocationsPage'),
})

const withdrawalsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/withdrawals',
  validateSearch: z.object({
    // 'ALL' = no status filter (the API's status is optional).
    status: z
      .enum(['ALL', 'REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'PAYOUT_FAILED', 'CANCELLED'])
      .catch('REQUESTED')
      .default('REQUESTED'),
    ...pageSearch,
    id: z.string().uuid().optional().catch(undefined),
  }),
  component: lazyRouteComponent(() => import('@/features/withdrawals/pages/withdrawals-page'), 'WithdrawalsPage'),
})

const bankAccountsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/bank-accounts',
  validateSearch: z.object({
    status: z
      .enum(['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'REPLACED'])
      .catch('PENDING_VERIFICATION')
      .default('PENDING_VERIFICATION'),
    ...pageSearch,
    id: z.string().uuid().optional().catch(undefined),
  }),
  component: lazyRouteComponent(() => import('@/features/bank-accounts/pages/bank-accounts-page'), 'BankAccountsPage'),
})

export const membersSearchSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['REGISTERED', 'KYC_SUBMITTED', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
  page: z.number().int().min(0).catch(0).default(0),
  size: z.number().int().min(1).max(100).catch(20).default(20),
})

const membersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/members',
  validateSearch: membersSearchSchema,
  component: lazyRouteComponent(() => import('@/features/members/pages/members-page'), 'MembersPage'),
})

const AdminUsersPage = lazyRouteComponent(() => import('@/features/admins/pages/admin-users-page'), 'AdminUsersPage')

const adminUsersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin-users',
  component: () => (
    <RequireRole requiredRole="SUPER_ADMIN">
      <AdminUsersPage />
    </RequireRole>
  ),
})

const paymentAccountsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/payment-accounts',
  validateSearch: z.object({ status: z.enum(['ACTIVE', 'ARCHIVED']).catch('ACTIVE').default('ACTIVE') }),
  component: lazyRouteComponent(() => import('@/features/payment-accounts/pages/payment-accounts-page'), 'PaymentAccountsPage'),
})

const supportRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/support',
  validateSearch: z.object({
    // Default to the open queue (matches the dashboard "open support" count).
    status: z.enum(['OPEN', 'RESOLVED']).optional().catch('OPEN').default('OPEN'),
    priority: z.enum(['NORMAL', 'HIGH']).optional().catch(undefined),
    ...pageSearch,
    id: z.string().uuid().optional().catch(undefined),
  }),
  component: lazyRouteComponent(() => import('@/features/support/pages/support-page'), 'SupportPage'),
})

const SettingsPage = lazyRouteComponent(() => import('@/features/settings/pages/settings-page'), 'SettingsPage')

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/settings',
  component: () => (
    <RequireRole requiredRole="SUPER_ADMIN">
      <SettingsPage />
    </RequireRole>
  ),
})

const auditRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/audit',
  validateSearch: z.object({
    entityType: z.string().max(50).optional().catch(undefined),
    entityId: z.string().max(100).optional().catch(undefined),
    limit: z.number().int().min(1).max(500).catch(50).default(50),
  }),
  component: lazyRouteComponent(() => import('@/features/audit/pages/audit-page'), 'AuditPage'),
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appLayoutRoute.addChildren([
    indexRoute,
    approvalsRoute,
    paymentsRoute,
    membersRoute,
    memberDetailRoute,
    pnlRoute,
    pnlPreviewRoute,
    pnlAllocationsRoute,
    withdrawalsRoute,
    bankAccountsRoute,
    paymentAccountsRoute,
    supportRoute,
    settingsRoute,
    auditRoute,
    adminUsersRoute,
  ]),
])

export function makeRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof makeRouter>
  }
}
