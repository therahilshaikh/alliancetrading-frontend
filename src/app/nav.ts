import {
  BadgeCheck,
  Banknote,
  ClipboardList,
  FileCheck2,
  Home,
  Landmark,
  LifeBuoy,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardSummary } from '@/features/dashboard/api'

export type NavPath =
  | '/'
  | '/approvals'
  | '/payments'
  | '/members'
  | '/pnl'
  | '/withdrawals'
  | '/bank-accounts'
  | '/payment-accounts'
  | '/support'
  | '/settings'
  | '/audit'
  | '/admin-users'

export interface NavItem {
  to: NavPath
  label: string
  icon: LucideIcon
  /** Queue count from GET /admin/dashboard, shown as a badge. */
  count?: (d: DashboardSummary) => number | undefined
  superAdminOnly?: boolean
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operations',
    items: [
      { to: '/', label: 'Overview', icon: Home },
      { to: '/approvals', label: 'Account approvals', icon: BadgeCheck, count: (d) => d.actionCenter?.kycPending },
      { to: '/payments', label: 'Payment proofs', icon: FileCheck2, count: (d) => d.actionCenter?.investmentPending },
      { to: '/members', label: 'Members', icon: Users },
      { to: '/support', label: 'Support', icon: LifeBuoy, count: (d) => d.actionCenter?.supportOpen },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/pnl', label: 'Profit & loss', icon: TrendingUp, count: (d) => d.actionCenter?.pnlAwaitingMyApproval },
      { to: '/withdrawals', label: 'Withdrawals', icon: Wallet, count: (d) => d.actionCenter?.withdrawalOpen },
      { to: '/bank-accounts', label: 'Bank accounts', icon: Landmark, count: (d) => d.actionCenter?.bankPending },
      { to: '/payment-accounts', label: 'Payment accounts', icon: Banknote },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings, superAdminOnly: true },
    ],
  },
  {
    label: 'Oversight',
    items: [
      { to: '/audit', label: 'Audit log', icon: ClipboardList },
      { to: '/admin-users', label: 'Admin users', icon: ShieldCheck, superAdminOnly: true },
    ],
  },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

export function navLabel(pathname: string): string | undefined {
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((i) => (i.to === '/' ? pathname === '/' : pathname === i.to || pathname.startsWith(`${i.to}/`)))
  return match?.label
}
