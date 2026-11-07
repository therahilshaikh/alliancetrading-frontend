import { Link } from '@tanstack/react-router'
import {
  BadgeCheck,
  ChevronRight,
  Clock,
  FileCheck2,
  Landmark,
  LifeBuoy,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState, PageHeader, Panel } from '@/components/shared/layout'
import { formatLongDateIST, formatMoneyCompact, formatMoneyPlain, greetingIST } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/app/auth'
import { useDashboard, type DashboardSummary } from '../api'

type ActionCenter = NonNullable<DashboardSummary['actionCenter']>

interface StatCard {
  label: string
  icon: LucideIcon
  tone: string
  value: (d: DashboardSummary) => string
  change: (d: DashboardSummary) => string
}

const STATS: StatCard[] = [
  {
    label: 'Active investors',
    icon: Users,
    tone: 'bg-brand-soft text-brand dark:bg-brand/15 dark:text-indigo-300',
    value: (d) => (d.stats?.activeInvestors?.value ?? 0).toLocaleString('en-IN'),
    change: (d) =>
      `+${(d.stats?.activeInvestors?.newThisMonth ?? 0).toLocaleString('en-IN')} this month`,
  },
  {
    label: 'Funds invested',
    icon: FileCheck2,
    tone: 'bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400',
    value: (d) => formatMoneyCompact(d.stats?.fundsInvested?.value ?? 0),
    change: (d) => `${formatMoneyCompact(d.stats?.fundsInvested?.thisMonth ?? 0)} this month`,
  },
  {
    label: 'Profit credited',
    icon: TrendingUp,
    tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400',
    value: (d) => formatMoneyCompact(d.stats?.profitCredited?.value ?? 0),
    change: (d) => `${formatMoneyPlain(d.stats?.profitCredited?.today ?? 0)} today`,
  },
  {
    label: 'Pending actions',
    icon: Clock,
    tone: 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400',
    value: (d) => (d.stats?.pendingActions?.value ?? 0).toLocaleString('en-IN'),
    change: () => 'Needs review',
  },
]

// Each target page opens on its pending queue by default.
const ACTIONS: {
  label: string
  icon: LucideIcon
  count: keyof ActionCenter
  to: '/approvals' | '/payments' | '/withdrawals' | '/support' | '/bank-accounts' | '/pnl'
}[] = [
  { label: 'New account approvals', icon: BadgeCheck, count: 'kycPending', to: '/approvals' },
  { label: 'Investment proofs', icon: FileCheck2, count: 'investmentPending', to: '/payments' },
  { label: 'Withdrawal requests', icon: Wallet, count: 'withdrawalOpen', to: '/withdrawals' },
  { label: 'Open support queries', icon: LifeBuoy, count: 'supportOpen', to: '/support' },
  {
    label: 'Bank account verifications',
    icon: Landmark,
    count: 'bankPending',
    to: '/bank-accounts',
  },
  { label: 'P&L approvals', icon: TrendingUp, count: 'pnlAwaitingMyApproval', to: '/pnl' },
]

const waiting = (n: number) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? 'request' : 'requests'} waiting`

export function DashboardPage() {
  const { admin } = useAuth()
  const { data, isLoading, error, refetch } = useDashboard()
  const name = admin?.displayName || 'Admin'

  return (
    <>
      <PageHeader
        eyebrow={formatLongDateIST()}
        title={`${greetingIST()}, ${name}`}
        description="Here is what needs your attention across Alliance Trading today."
      />

      {error ? (
        <Panel>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {STATS.map((stat) => (
              <Panel key={stat.label} className="p-5">
                <div className={cn('grid size-10 place-items-center rounded-2xl', stat.tone)}>
                  <stat.icon className="size-5" aria-hidden />
                </div>
                <p className="mt-5 text-xs font-semibold text-slate-400">{stat.label}</p>
                {isLoading || !data ? (
                  <>
                    <Skeleton className="mt-2 h-7 w-20" />
                    <Skeleton className="mt-3 h-3 w-24" />
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums">{stat.value(data)}</p>
                    <p className="mt-2 text-[10px] font-bold text-slate-400">{stat.change(data)}</p>
                  </>
                )}
              </Panel>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <Panel>
              <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-white/5">
                <div>
                  <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                    Action center
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold">Pending requests</h2>
                </div>
                {data ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                    {(data.actionCenter?.total ?? 0).toLocaleString('en-IN')} pending
                  </span>
                ) : null}
              </div>
              {ACTIONS.map((item, index) => (
                <Link
                  key={item.label}
                  to={item.to}
                  search={item.to === '/pnl' ? { tab: 'awaiting' } : undefined}
                  className={cn(
                    'flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-white/5 dark:focus-visible:bg-white/5',
                    index !== ACTIONS.length - 1 && 'border-b border-slate-100 dark:border-white/5',
                  )}
                >
                  <div className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    <item.icon className="size-5" aria-hidden />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-extrabold">{item.label}</p>
                    {data ? (
                      <p className="mt-1 text-xs text-slate-400">
                        {waiting(data.actionCenter?.[item.count] ?? 0)}
                      </p>
                    ) : (
                      <Skeleton className="mt-2 h-3 w-28" />
                    )}
                  </div>
                  <ChevronRight className="size-4 text-slate-300" aria-hidden />
                </Link>
              ))}
            </Panel>

            <DailyProfit distribution={data?.todayDistribution} loading={isLoading} />
          </div>
        </>
      )}
    </>
  )
}

function DailyProfit({
  distribution,
  loading,
}: {
  distribution: DashboardSummary['todayDistribution']
  loading: boolean
}) {
  const recipients = distribution?.recipients ?? 0
  const eligible = distribution?.eligible ?? 0
  const pct = eligible > 0 ? Math.min(100, Math.round((recipients / eligible) * 100)) : 0

  return (
    <Panel className="flex flex-col p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Today&apos;s distribution
          </p>
          <h2 className="mt-1 text-lg font-extrabold">Daily profit</h2>
        </div>
        <div className="grid size-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
          <TrendingUp className="size-5" aria-hidden />
        </div>
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-8 h-10 w-36" />
          <Skeleton className="mt-3 h-3 w-44" />
        </>
      ) : (
        <>
          <p className="mt-8 text-4xl font-extrabold tabular-nums">
            {formatMoneyPlain(distribution?.total ?? 0)}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Credited to {recipients.toLocaleString('en-IN')} eligible{' '}
            {recipients === 1 ? 'user' : 'users'}
          </p>
        </>
      )}
      <div
        className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
        role="progressbar"
        aria-label="Eligible users credited today"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <Button asChild variant="outline" className="mt-6 min-h-10 rounded-xl text-xs font-extrabold">
        <Link to="/pnl">
          <TrendingUp className="size-4" aria-hidden /> Manage today&apos;s profit
        </Link>
      </Button>
    </Panel>
  )
}
