import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { authClient } from '../lib/auth-client'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { ErrorState } from '../components/ui/error-state'
import { getRecentViewIds } from '../lib/recentViews'
import {
  ActivityChart,
  AGENT_CHART_SERIES,
  ADMIN_CHART_SERIES,
  ChartSkeleton,
  formatDay,
} from '../components/dashboard/ActivityChart'
import { StatCard, StatSkeletons, shareOf } from '../components/dashboard/StatCards'
import { TicketSlideshow } from '../components/dashboard/TicketSlideshow'
import { OnlineAgents } from '../components/dashboard/OnlineAgents'
import type { OnlineAgent, TicketCard } from '../components/dashboard/types'
import {
  Ticket,
  Clock,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  Settings,
  Eye,
  EyeOff,
  X,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminStats = {
  total: number
  ongoing: number
  resolvedByAI: number
  resolvedByAgents: number
  critical: number
  openTickets: TicketCard[]
  onlineAgents: OnlineAgent[]
}

type AgentStats = {
  total: number
  ongoing: number
  resolvedClosed: number
  new: number
  openTickets: TicketCard[]
}

type AdminChartData = {
  days: string[]
  received: number[]
  resolved: number[]
  resolvedByAI: number[]
  resolvedByAgents: number[]
}

type AgentChartData = {
  days: string[]
  received: number[]
  resolved: number[]
}
// ─── Admin dashboard ──────────────────────────────────────────────────────────

function AdminDashboard() {
  const {
    data: stats,
    isPending: statsPending,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<AdminStats>({
    queryKey: ['ticketStats'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tickets/stats')
      return data
    },
    // Keep the online-agent tags (and stat cards) live without a manual refresh.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  const {
    data: chart,
    isPending: chartPending,
    isError: chartError,
    refetch: refetchChart,
  } = useQuery<AdminChartData>({
    queryKey: ['ticketChart', 'admin'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tickets/chart')
      return data
    },
  })

  const chartPoints = chart
    ? chart.days.map((day, i) => ({
        day: formatDay(day),
        Received:             chart.received[i],
        Resolved:             chart.resolved[i],
        'Resolved by AI':     chart.resolvedByAI[i],
        'Resolved by Agents': chart.resolvedByAgents[i],
      }))
    : []

  const statCards = [
    { icon: Ticket, label: 'Total Tickets', value: stats?.total ?? 0, detail: 'Across the support queue', tone: 'bg-primary/10 text-primary', accent: 'before:bg-primary' },
    { icon: Clock, label: 'Ongoing Tickets', value: stats?.ongoing ?? 0, detail: shareOf(stats?.ongoing ?? 0, stats?.total ?? 0), tone: 'bg-status-inprogress-soft text-status-inprogress', accent: 'before:bg-status-inprogress' },
    { icon: Brain, label: 'Resolved by AI', value: stats?.resolvedByAI ?? 0, detail: shareOf(stats?.resolvedByAI ?? 0, stats?.total ?? 0), tone: 'bg-status-ai-resolved-soft text-status-ai-resolved', accent: 'before:bg-status-ai-resolved' },
    { icon: CheckCircle2, label: 'Resolved by Agents', value: stats?.resolvedByAgents ?? 0, detail: shareOf(stats?.resolvedByAgents ?? 0, stats?.total ?? 0), tone: 'bg-status-resolved-soft text-status-resolved', accent: 'before:bg-status-resolved' },
    { icon: AlertTriangle, label: 'Critical Tickets', value: stats?.critical ?? 0, detail: 'High priority, unresolved', tone: 'bg-status-danger-soft text-status-danger', accent: 'before:bg-status-danger' },
  ]

  return (
    <div className="space-y-6">
      <section aria-label="Ticket overview">
        {statsError ? (
          <ErrorState
            className="min-h-32"
            title="Ticket overview unavailable"
            description="Dashboard totals could not be loaded."
            action={<Button variant="outline" size="sm" onClick={() => void refetchStats()}>Try again</Button>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {statsPending
              ? <StatSkeletons count={5} />
              : statCards.map(item => <StatCard key={item.label} {...item} />)}
          </div>
        )}
      </section>

      {chartPending ? (
        <ChartSkeleton title="Ticket Activity — Last 30 Days" />
      ) : chartError ? (
        <ErrorState
          title="Activity chart unavailable"
          description="Ticket activity for the last 30 days could not be loaded."
          action={<Button variant="outline" size="sm" onClick={() => void refetchChart()}>Try again</Button>}
        />
      ) : (
        <ActivityChart
          title="Ticket Activity — Last 30 Days"
          description="Incoming volume and resolution ownership"
          data={chartPoints}
          series={ADMIN_CHART_SERIES}
        />
      )}

      <section>
        <h2 className="mb-3 text-body-lg font-semibold tracking-tight text-foreground">New Tickets</h2>
        <TicketSlideshow
          tickets={stats?.openTickets ?? []}
          isPending={statsPending}
          isError={statsError}
          onRetry={() => void refetchStats()}
          emptyMessage="No open tickets at the moment."
        />
      </section>

      <section>
        <h2 className="mb-3 text-body-lg font-semibold tracking-tight text-foreground">Online Agents</h2>
        <OnlineAgents
          agents={stats?.onlineAgents ?? []}
          isPending={statsPending}
          isError={statsError}
          onRetry={() => void refetchStats()}
        />
      </section>
    </div>
  )
}

// ─── Agent dashboard ──────────────────────────────────────────────────────────

function AgentDashboard({ userId }: { userId: string }) {
  const viewedIds = getRecentViewIds(userId)

  const {
    data: statsData,
    isPending: statsPending,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<AgentStats>({
    queryKey: ['ticketStats'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tickets/stats')
      return data
    },
  })

  const {
    data: chart,
    isPending: chartPending,
    isError: chartError,
    refetch: refetchChart,
  } = useQuery<AgentChartData>({
    queryKey: ['ticketChart', 'agent'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tickets/chart')
      return data
    },
  })

  const {
    data: recentViewed = [],
    isPending: recentPending,
    isError: recentError,
    refetch: refetchRecent,
  } = useQuery<TicketCard[]>({
    queryKey: ['recentViewed', viewedIds],
    queryFn: async () => {
      if (viewedIds.length === 0) return []
      const { data } = await axios.get(`/api/tickets/by-ids?ids=${viewedIds.join(',')}`)
      return data
    },
    enabled: viewedIds.length > 0,
  })

  const chartPoints = chart
    ? chart.days.map((day, i) => ({
        day: formatDay(day),
        Received: chart.received[i],
        'Resolved / Closed': chart.resolved[i],
      }))
    : []

  const statCards = [
    { icon: Ticket, label: 'Total Tickets', value: statsData?.total ?? 0, detail: 'Assigned to you', tone: 'bg-primary/10 text-primary', accent: 'before:bg-primary' },
    { icon: Inbox, label: 'New Tickets', value: statsData?.new ?? 0, detail: shareOf(statsData?.new ?? 0, statsData?.total ?? 0), tone: 'bg-status-open-soft text-status-open', accent: 'before:bg-status-open' },
    { icon: Clock, label: 'Ongoing Tickets', value: statsData?.ongoing ?? 0, detail: shareOf(statsData?.ongoing ?? 0, statsData?.total ?? 0), tone: 'bg-status-inprogress-soft text-status-inprogress', accent: 'before:bg-status-inprogress' },
    { icon: CheckCircle2, label: 'Resolved / Closed', value: statsData?.resolvedClosed ?? 0, detail: shareOf(statsData?.resolvedClosed ?? 0, statsData?.total ?? 0), tone: 'bg-status-resolved-soft text-status-resolved', accent: 'before:bg-status-resolved' },
  ]

  return (
    <div className="space-y-6">
      <section aria-label="Ticket overview">
        {statsError ? (
          <ErrorState
            className="min-h-32"
            title="Ticket overview unavailable"
            description="Your ticket totals could not be loaded."
            action={<Button variant="outline" size="sm" onClick={() => void refetchStats()}>Try again</Button>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statsPending
              ? <StatSkeletons count={4} />
              : statCards.map(item => <StatCard key={item.label} {...item} />)}
          </div>
        )}
      </section>

      {chartPending ? (
        <ChartSkeleton title="Your Ticket Activity — Last 30 Days" />
      ) : chartError ? (
        <ErrorState
          title="Activity chart unavailable"
          description="Your ticket activity for the last 30 days could not be loaded."
          action={<Button variant="outline" size="sm" onClick={() => void refetchChart()}>Try again</Button>}
        />
      ) : (
        <ActivityChart
          title="Your Ticket Activity — Last 30 Days"
          description="Tickets received and completed in your queue"
          data={chartPoints}
          series={AGENT_CHART_SERIES}
        />
      )}

      <section>
        <h2 className="mb-3 text-body-lg font-semibold tracking-tight text-foreground">New Tickets</h2>
        <TicketSlideshow
          tickets={statsData?.openTickets ?? []}
          isPending={statsPending}
          isError={statsError}
          onRetry={() => void refetchStats()}
          emptyMessage="No open tickets assigned to you."
        />
      </section>

      <section>
        <h2 className="mb-3 text-body-lg font-semibold tracking-tight text-foreground">Recent Tickets</h2>
        <TicketSlideshow
          tickets={viewedIds.length === 0 ? [] : recentViewed}
          isPending={viewedIds.length > 0 && recentPending}
          isError={viewedIds.length > 0 && recentError}
          onRetry={() => void refetchRecent()}
          emptyMessage="No recently viewed tickets."
        />
      </section>
    </div>
  )
}

// ─── Agent settings modal ─────────────────────────────────────────────────────

function AgentSettingsModal({
  user,
  onClose,
  onProfileUpdated,
}: {
  user: { id: string; name: string; email: string }
  onClose: () => void
  onProfileUpdated: (name: string, email: string) => void
}) {
  const [name,     setName]     = useState(user.name)
  const [email,    setEmail]    = useState(user.email)
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)

  const [profileSaving,  setProfileSaving]  = useState(false)
  const [profileError,   setProfileError]   = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)

  const [pwSaving,  setPwSaving]  = useState(false)
  const [pwError,   setPwError]   = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  const handleProfileSave = async () => {
    setProfileError(null)
    setProfileSuccess(false)
    if (!name.trim() || name.trim().length < 2) { setProfileError('Name must be at least 2 characters'); return }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setProfileError('Enter a valid email'); return }
    setProfileSaving(true)
    try {
      const { data } = await axios.patch<{ name: string; email: string }>('/api/users/me/profile', { name: name.trim(), email: email.trim() })
      setProfileSuccess(true)
      onProfileUpdated(data.name, data.email)
    } catch (err: any) {
      setProfileError(err?.response?.data?.error ?? 'Failed to update profile')
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordSave = async () => {
    setPwError(null)
    setPwSuccess(false)
    if (password.length < 8) { setPwError('Password must be at least 8 characters'); return }
    setPwSaving(true)
    try {
      await axios.patch('/api/users/me', { password })
      setPwSuccess(true)
      setPassword('')
      setShowPw(false)
    } catch (err: any) {
      setPwError(err?.response?.data?.error ?? 'Failed to update password')
    } finally {
      setPwSaving(false)
    }
  }

  const profileChanged = name.trim() !== user.name || email.trim() !== user.email

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Profile */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Profile</p>
          <div className="space-y-1.5">
            <Label htmlFor="settings-name" className="text-sm text-gray-700">Name</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={e => { setName(e.target.value); setProfileError(null); setProfileSuccess(false) }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-email" className="text-sm text-gray-700">Email</Label>
            <Input
              id="settings-email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setProfileError(null); setProfileSuccess(false) }}
              autoComplete="off"
            />
          </div>
          {profileError   && <p className="text-xs text-red-600">{profileError}</p>}
          {profileSuccess && <p className="text-xs text-green-600">Profile updated.</p>}
          <Button className="w-full" onClick={handleProfileSave} disabled={profileSaving || !profileChanged}>
            {profileSaving ? 'Saving…' : 'Save Profile'}
          </Button>
        </div>

        {/* Password */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Change Password</p>
          <div className="relative">
            <Input
              id="settings-pw"
              type={showPw ? 'text' : 'password'}
              placeholder="New password (min 8 chars)"
              value={password}
              onChange={e => { setPassword(e.target.value); setPwError(null); setPwSuccess(false) }}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {pwError   && <p className="text-xs text-red-600">{pwError}</p>}
          {pwSuccess && <p className="text-xs text-green-600">Password updated.</p>}
          <Button className="w-full" onClick={handlePasswordSave} disabled={pwSaving || !password}>
            {pwSaving ? 'Saving…' : 'Update Password'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const user = session?.user as { role?: string; id?: string; name?: string; email?: string } | undefined
  const isAdmin = user?.role === 'ADMIN'
  const userId = user?.id ?? ''
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [displayName,  setDisplayName]  = useState<string | null>(null)
  const [displayEmail, setDisplayEmail] = useState<string | null>(null)

  const shownName  = displayName  ?? user?.name  ?? ''
  const shownEmail = displayEmail ?? user?.email ?? ''

  return (
    <div>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1 font-semibold tracking-tight text-foreground">
              Welcome back, {shownName}
            </h1>
            <p className="mt-1 text-body text-muted-foreground">{shownEmail}</p>
          </div>
          {!isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings aria-hidden="true" />
              Settings
            </Button>
          )}
        </div>

        {sessionPending ? (
          <div className="space-y-6" aria-label="Loading dashboard">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatSkeletons count={4} />
            </div>
            <ChartSkeleton title="Ticket Activity — Last 30 Days" />
          </div>
        ) : isAdmin ? (
          <AdminDashboard />
        ) : (
          <AgentDashboard userId={userId} />
        )}
      </div>

      {settingsOpen && user && (
        <AgentSettingsModal
          user={{ id: userId, name: shownName, email: shownEmail }}
          onClose={() => setSettingsOpen(false)}
          onProfileUpdated={(name, email) => { setDisplayName(name); setDisplayEmail(email) }}
        />
      )}
    </div>
  )
}
