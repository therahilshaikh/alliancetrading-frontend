import { useState, type FormEvent } from 'react'
import { Link, Navigate, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { ChevronRight, KeyRound, LogOut, Moon, Search, Sun } from 'lucide-react'
import { ChangePasswordDialog } from '@/features/admins/components/change-password-dialog'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmProvider } from '@/components/shared/confirm'
import { useDashboard } from '@/features/dashboard/api'
import { humanize, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from './auth'
import { IdleLogout } from './idle-logout'
import { NAV_GROUPS, navLabel } from './nav'
import { useTheme } from './theme'

/** Authenticated layout: auth gate, sidebar, top bar, breadcrumbs, idle logout. */
export function AppShell() {
  const { status, sessionEndReason } = useAuth()

  if (status === 'loading') {
    return (
      <div className="bg-canvas dark:bg-canvas-dark flex min-h-screen items-center justify-center">
        <div
          className="h-2 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
          role="progressbar"
          aria-label="Loading"
        >
          <div className="animate-loading bg-brand h-full rounded-full" />
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    const search =
      sessionEndReason === 'session_expired' ? { reason: 'expired' as const } : undefined
    return <Navigate to="/login" search={search} />
  }

  return (
    <ConfirmProvider>
      <IdleLogout />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-canvas dark:bg-canvas-dark">
          <TopBar />
          <main id="main" className="mx-auto w-full max-w-7xl p-5 sm:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ConfirmProvider>
  )
}

function AppSidebar() {
  const { role } = useAuth()
  const { data: dashboard } = useDashboard()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200 dark:border-white/10">
      <SidebarHeader className="p-4">
        <Link
          to="/"
          className="flex items-center gap-3 px-1"
          aria-label="AllianceTrading Admin home"
        >
          <div className="bg-brand shadow-brand grid size-10 shrink-0 place-items-center rounded-2xl text-sm font-black text-white">
            A
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-extrabold">Alliance Admin</p>
            <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
              Operations console
            </p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.superAdminOnly || role === 'SUPER_ADMIN')
          if (!items.length) return null
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[10px] font-extrabold tracking-widest uppercase">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu className="gap-1">
                {items.map((item) => {
                  const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
                  const count = dashboard && item.count ? item.count(dashboard) : undefined
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          'h-11 rounded-2xl px-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
                          'data-[active=true]:bg-brand-soft data-[active=true]:text-brand dark:data-[active=true]:bg-brand/15 dark:data-[active=true]:text-white',
                        )}
                      >
                        <Link to={item.to}>
                          <item.icon className="size-[18px]" aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count ? (
                        <SidebarMenuBadge
                          // Rows are h-11 (44px), not the 32px the base badge offset assumes, so centre it on the row
                          // and inset it to match the row's px-3 padding.
                          className="peer-data-[size=default]/menu-button:top-1/2 right-3 -translate-y-1/2 rounded-full bg-slate-100 px-1.5 text-[10px] leading-none font-extrabold text-slate-600 dark:bg-white/10 dark:text-slate-300"
                          aria-label={`${count} pending`}
                        >
                          {count}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:hidden">
        <p className="px-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          All times in IST
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}

function TopBar() {
  const { admin, role, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [passwordOpen, setPasswordOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const title = navLabel(pathname) ?? 'Admin'

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = search.trim()
    if (!q) return
    void navigate({ to: '/members', search: { search: q, page: 0 } })
    setSearch('')
  }

  return (
    <header className="dark:bg-surface-dark/90 sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-white/10">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <SidebarTrigger aria-label="Toggle navigation" />
        <nav
          aria-label="Breadcrumb"
          className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex"
        >
          <Link
            to="/"
            className="hover:text-foreground font-semibold text-slate-500 dark:text-slate-400"
          >
            Admin
          </Link>
          {pathname !== '/' ? (
            <>
              <ChevronRight className="size-3.5 text-slate-400" aria-hidden />
              <span className="truncate font-extrabold" aria-current="page">
                {title}
              </span>
            </>
          ) : null}
        </nav>
        <form onSubmit={onSearch} role="search" className="ml-auto w-full max-w-xs">
          <label htmlFor="member-search" className="sr-only">
            Search members by name or mobile
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              id="member-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members"
              className="h-10 rounded-xl pl-9"
            />
          </div>
        </form>
        <Button
          variant="outline"
          size="icon"
          className="size-10 shrink-0 rounded-xl"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="bg-brand hover:bg-brand-dark size-10 shrink-0 rounded-full p-0 text-xs font-extrabold text-white hover:text-white"
              aria-label="Account menu"
            >
              {initials(admin?.displayName ?? admin?.email)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="space-y-0.5">
              {admin?.displayName ? (
                <p className="truncate text-sm font-bold">{admin.displayName}</p>
              ) : null}
              {admin?.email ? (
                <p className="text-muted-foreground truncate text-xs font-semibold">
                  {admin.email}
                </p>
              ) : null}
              <p className="text-muted-foreground text-xs font-semibold">
                {humanize(role ?? 'ADMIN')}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
              <KeyRound className="size-4" /> Change password
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void logout()}>
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChangePasswordDialog
          key={passwordOpen ? 'open' : 'closed'}
          open={passwordOpen}
          onOpenChange={setPasswordOpen}
        />
      </div>
    </header>
  )
}
