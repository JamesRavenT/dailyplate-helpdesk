import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import {
  BookOpen,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Ticket,
  Users,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useIdleLogout } from '@/hooks/useIdleLogout'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'
import { endSession } from '@/lib/session'

type AgentStatus = 'ONLINE' | 'AWAY' | 'MEETING' | 'OFFLINE'

type SessionUser = {
  id: string
  name: string
  email: string
  role?: 'ADMIN' | 'AGENT'
  online_status?: AgentStatus
}

type NavigationItem = {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
  adminOnly?: boolean
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; dot: string }> = {
  ONLINE: { label: 'Online', dot: 'bg-status-resolved' },
  AWAY: { label: 'Away', dot: 'bg-status-inprogress' },
  MEETING: { label: 'Meeting', dot: 'bg-status-danger' },
  OFFLINE: { label: 'Offline', dot: 'bg-muted-foreground' },
}

const SELECTABLE_STATUSES: AgentStatus[] = ['ONLINE', 'AWAY', 'MEETING']

const NAVIGATION: NavigationItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
  { label: 'Tickets', to: '/tickets', icon: Ticket },
  { label: 'Resources', to: '/resources', icon: BookOpen },
  { label: 'Users', to: '/users', icon: Users, adminOnly: true },
]

function pageTitle(pathname: string) {
  if (pathname.startsWith('/tickets/')) return 'Ticket details'
  if (pathname.startsWith('/tickets')) return 'Tickets'
  if (pathname.startsWith('/resources')) return 'Resources'
  if (pathname.startsWith('/users')) return 'Users'
  return 'Dashboard'
}

function SidebarContent({
  expanded,
  isAdmin,
  newCount,
  onNavigate,
}: {
  expanded: boolean
  isAdmin: boolean
  newCount: number
  onNavigate?: () => void
}) {
  return (
    <>
      <div className="flex h-16 items-center border-b border-sidebar-border px-3 lg:px-4">
        <NavLink
          to="/"
          aria-label="DailyPlate Helpdesk home"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-3 rounded-lg text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-e1">
            <UtensilsCrossed aria-hidden="true" className="size-5" />
          </span>
          <span className={cn('min-w-0', expanded ? 'block' : 'hidden lg:block')}>
            <span className="block truncate text-label font-semibold tracking-tight">DailyPlate</span>
            <span className="block truncate text-caption text-sidebar-foreground/55">Helpdesk</span>
          </span>
        </NavLink>
      </div>

      <nav aria-label="Primary navigation" className="flex-1 space-y-1 px-2 py-4 lg:px-3">
        {NAVIGATION.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const Icon = item.icon
          const showCount = item.to === '/tickets' && !isAdmin && newCount > 0

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              aria-label={showCount ? `${item.label}, ${newCount > 99 ? '99 plus' : newCount} new` : item.label}
              title={!expanded ? item.label : undefined}
              onClick={onNavigate}
              className={({ isActive }) => cn(
                "relative flex h-10 items-center gap-3 rounded-lg px-3 text-label font-medium text-sidebar-foreground/65 outline-none transition-[color,background-color] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-transparent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar motion-reduce:transition-none",
                expanded ? 'justify-start' : 'md:justify-center lg:justify-start',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground before:bg-sidebar-primary'
                  : 'hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )}
            >
              <Icon aria-hidden="true" className="size-[18px] shrink-0" />
              <span className={cn('truncate', expanded ? 'block' : 'hidden lg:block')}>
                {item.label}
              </span>
              {showCount ? (
                <span
                  data-testid="new-ticket-count"
                  aria-hidden="true"
                  className={cn(
                    'relative ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-status-danger px-1 font-mono text-[10px] font-semibold leading-none text-white',
                    !expanded && 'absolute right-1 md:right-0.5 lg:static',
                  )}
                >
                  <span className="absolute inset-0 animate-ping rounded-full bg-status-danger opacity-45 motion-reduce:hidden" />
                  <span className="relative">{newCount > 99 ? '99+' : newCount}</span>
                </span>
              ) : null}
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}

export default function AppShell() {
  const { data: session } = authClient.useSession()
  const location = useLocation()
  const { showWarning, remainingSeconds, staySignedIn } = useIdleLogout()
  const user = session?.user as SessionUser | undefined
  const isAdmin = user?.role === 'ADMIN'
  const sessionStatus = user?.online_status

  const [status, setStatus] = useState<AgentStatus>('OFFLINE')
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const topbarMenusRef = useRef<HTMLDivElement>(null)

  const { data: statsData } = useQuery({
    queryKey: ['tickets', 'stats'],
    queryFn: async () => {
      const { data } = await axios.get<{ new: number }>('/api/tickets/stats')
      return data
    },
    enabled: !isAdmin && !!session,
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const newCount = statsData?.new ?? 0
  const statusConfig = STATUS_CONFIG[status]
  const currentPage = pageTitle(location.pathname)
  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'U'

  useEffect(() => {
    if (!session || isAdmin) return
    const current = sessionStatus ?? 'OFFLINE'
    if (current === 'OFFLINE') {
      setStatus('ONLINE')
      axios.patch('/api/users/status', { status: 'ONLINE' }).catch(() => {})
    } else {
      setStatus(current)
    }
  }, [session?.user?.id])

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (topbarMenusRef.current && !topbarMenusRef.current.contains(event.target as Node)) {
        setStatusMenuOpen(false)
        setUserMenuOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setStatusMenuOpen(false)
        setUserMenuOpen(false)
        setMobileOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  async function handleStatusChange(next: AgentStatus) {
    setStatus(next)
    setStatusMenuOpen(false)
    await axios.patch('/api/users/status', { status: next }).catch(() => {})
  }

  async function handleSignOut() {
    setUserMenuOpen(false)
    if (!isAdmin) {
      await axios.patch('/api/users/status', { status: 'OFFLINE' }).catch(() => {})
    }
    await endSession('/login')
  }

  const warningMinutes = Math.floor(remainingSeconds / 60)
  const warningSeconds = remainingSeconds % 60
  const warningCountdown = `${warningMinutes}:${warningSeconds.toString().padStart(2, '0')}`

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Dialog open={showWarning}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your session is about to expire</DialogTitle>
            <DialogDescription>
              You will be signed out after {warningCountdown} of inactivity.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => void staySignedIn()}>
              Stay signed in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-label font-medium text-primary-foreground shadow-e2 transition-transform focus:translate-y-0 motion-reduce:transition-none"
      >
        Skip to content
      </a>

      <aside
        aria-hidden={mobileOpen || undefined}
        className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-sidebar-border bg-sidebar md:flex lg:w-60"
      >
        <SidebarContent expanded={false} isAdmin={isAdmin} newCount={newCount} />
      </aside>

      {mobileOpen ? (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-foreground/35 backdrop-blur-[1px] md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-e2 md:hidden"
          >
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
            <SidebarContent
              expanded
              isAdmin={isAdmin}
              newCount={newCount}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </>
      ) : null}

      <div className="min-h-screen md:pl-[72px] lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="Open navigation"
              aria-controls="mobile-navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu aria-hidden="true" />
            </Button>
            <span className="truncate text-label font-semibold tracking-tight text-foreground">
              {currentPage}
            </span>
          </div>

          {session ? (
            <div ref={topbarMenusRef} className="flex items-center gap-1.5 sm:gap-2">
              {!isAdmin ? (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Availability: ${statusConfig.label}`}
                    aria-haspopup="menu"
                    aria-expanded={statusMenuOpen}
                    onClick={() => {
                      setStatusMenuOpen((open) => !open)
                      setUserMenuOpen(false)
                    }}
                  >
                    <span aria-hidden="true" className={cn('size-2 rounded-full', statusConfig.dot)} />
                    <span className="hidden sm:inline">{statusConfig.label}</span>
                    <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  </Button>

                  {statusMenuOpen ? (
                    <div
                      role="menu"
                      aria-label="Set availability"
                      className="absolute right-0 mt-2 w-40 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-e2"
                    >
                      {SELECTABLE_STATUSES.map((next) => (
                        <button
                          key={next}
                          type="button"
                          role="menuitem"
                          onClick={() => void handleStatusChange(next)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-label outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                            status === next && 'font-semibold text-foreground',
                          )}
                        >
                          <span aria-hidden="true" className={cn('size-2 rounded-full', STATUS_CONFIG[next].dot)} />
                          {STATUS_CONFIG[next].label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Open user menu"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => {
                    setUserMenuOpen((open) => !open)
                    setStatusMenuOpen(false)
                  }}
                  className="max-w-48 gap-2 px-1.5 sm:px-2"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-caption font-semibold text-primary">
                    {initial}
                  </span>
                  <span className="hidden max-w-28 truncate text-label sm:inline">{user?.name}</span>
                  <ChevronDown aria-hidden="true" className="hidden size-3.5 text-muted-foreground sm:block" />
                </Button>

                {userMenuOpen ? (
                  <div
                    role="menu"
                    aria-label="User menu"
                    className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-e2"
                  >
                    <div className="border-b border-border px-2.5 py-2">
                      <p className="truncate text-label font-semibold">{user?.name}</p>
                      <p className="truncate text-caption text-muted-foreground">{user?.email}</p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleSignOut()}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-label text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                    >
                      <LogOut aria-hidden="true" className="size-4 text-muted-foreground" />
                      Sign Out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </header>

        <main id="main-content" className="px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
