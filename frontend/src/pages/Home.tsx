import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import Navbar from '../components/Navbar'
import { authClient } from '../lib/auth-client'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { getRecentViewIds } from '../lib/recentViews'
import {
  Ticket,
  Clock,
  Brain,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Settings,
  Eye,
  EyeOff,
  X,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type OnlineAgent = {
  id: string
  name: string
  email: string
  online_status: 'ONLINE' | 'AWAY' | 'MEETING'
}

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

type TicketCard = {
  id: string
  subject: string
  customer_name: string
  status: string
  priority: string | null
  created_at: string
  last_updated_at: string | null
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

// ─── Chart helpers ────────────────────────────────────────────────────────────

function formatDay(iso: string) {
  const [, month, day] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`
}

const CHART_COLORS = {
  received:         '#6366f1', // indigo  — neutral inbound
  resolved:         '#10b981', // emerald — positive outcome
  resolvedByAI:     '#a855f7', // purple  — AI (matches existing AI badges)
  resolvedByAgents: '#0ea5e9', // sky     — human agent work
}

// ─── Ticket slideshow ─────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  OPEN:          'bg-blue-100 text-blue-700',
  IN_PROGRESS:   'bg-amber-100 text-amber-700',
  RESOLVED:      'bg-green-100 text-green-700',
  CLOSED:        'bg-gray-100 text-gray-600',
  AI_RESOLVED:   'bg-purple-100 text-purple-700',
  AI_PROCESSING: 'bg-indigo-100 text-indigo-700',
}

const statusLabels: Record<string, string> = {
  OPEN:          'Open',
  IN_PROGRESS:   'In Progress',
  RESOLVED:      'Resolved',
  CLOSED:        'Closed',
  AI_RESOLVED:   'AI Resolved',
  AI_PROCESSING: 'AI Processing',
}

const priorityColors: Record<string, string> = {
  LOW:    'text-gray-500',
  MEDIUM: 'text-amber-600',
  HIGH:   'text-red-600',
}

const PAGE_SIZE = 2

function TicketSlideshow({
  tickets,
  isPending,
  emptyMessage,
}: {
  tickets: TicketCard[]
  isPending: boolean
  emptyMessage: string
}) {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)

  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE))

  useEffect(() => { setPage(0) }, [tickets.length])

  useEffect(() => {
    if (paused || totalPages <= 1) return
    const id = setInterval(() => {
      setPage(prev => (prev + 1) % totalPages)
    }, 4000)
    return () => clearInterval(id)
  }, [paused, totalPages])

  if (isPending) return <Skeleton className="h-32 w-full rounded-xl" />

  if (tickets.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  const safePage = page % totalPages
  const visible = tickets.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div
      className="flex flex-col items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map(ticket => (
          <div
            key={ticket.id}
            className="cursor-pointer"
            onClick={() => navigate(`/tickets/${ticket.id}`)}
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2 text-sm font-medium leading-snug">
                    {ticket.subject}
                  </CardTitle>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[ticket.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[ticket.status] ?? ticket.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{ticket.customer_name}</p>
                {ticket.priority && (
                  <p className={`mt-1 text-xs font-medium ${priorityColors[ticket.priority] ?? ''}`}>
                    {ticket.priority} priority
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(prev => (prev - 1 + totalPages) % totalPages)}
            className="rounded-full p-1 text-gray-400 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-2 w-2 rounded-full transition-colors ${i === safePage ? 'bg-gray-800' : 'bg-gray-300 hover:bg-gray-500'}`}
              />
            ))}
          </div>
          <button
            onClick={() => setPage(prev => (prev + 1) % totalPages)}
            className="rounded-full p-1 text-gray-400 hover:text-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  iconClass,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: number
  iconClass: string
  accent: string
}) {
  return (
    <Card className={`ring-0 border border-border border-l-4 ${accent}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <div className={`rounded-full p-2 ${iconClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

// ─── Stat skeleton row ────────────────────────────────────────────────────────

function StatSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
          <CardContent><Skeleton className="mt-2 h-8 w-12" /></CardContent>
        </Card>
      ))}
    </>
  )
}

// ─── Chart skeleton ───────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-4 w-40" /></CardHeader>
      <CardContent>
        <Skeleton className="h-52 w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

// ─── Online agents list ───────────────────────────────────────────────────────

const agentStatusDot: Record<string, string> = {
  ONLINE:  'bg-green-500',
  AWAY:    'bg-yellow-400',
  MEETING: 'bg-blue-500',
}

const agentStatusLabel: Record<string, string> = {
  ONLINE:  'Online',
  AWAY:    'Away',
  MEETING: 'In Meeting',
}

function OnlineAgentsList({ agents, isPending }: { agents: OnlineAgent[]; isPending: boolean }) {
  if (isPending) return <Skeleton className="h-32 w-full rounded-xl" />

  if (agents.length === 0) {
    return <p className="text-sm text-muted-foreground">No agents are currently online.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {agents.map(agent => (
        <div
          key={agent.id}
          className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3"
        >
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${agentStatusDot[agent.online_status] ?? 'bg-gray-400'}`} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{agent.name}</p>
            <p className="truncate text-xs text-muted-foreground">{agentStatusLabel[agent.online_status]}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Admin dashboard ──────────────────────────────────────────────────────────

function AdminDashboard() {
  const { data: stats, isPending: statsPending } = useQuery<AdminStats>({
    queryKey: ['ticketStats'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tickets/stats')
      return data
    },
    // Keep the online-agent tags (and stat cards) live without a manual refresh.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  const { data: chart, isPending: chartPending } = useQuery<AdminChartData>({
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
    { icon: Ticket,        label: 'Total Tickets',      value: stats?.total            ?? 0, iconClass: 'bg-blue-100 text-blue-600',    accent: 'border-l-cyan-500'    },
    { icon: Clock,         label: 'Ongoing Tickets',    value: stats?.ongoing          ?? 0, iconClass: 'bg-amber-100 text-amber-600',  accent: 'border-l-amber-500'   },
    { icon: Brain,         label: 'Resolved by AI',     value: stats?.resolvedByAI     ?? 0, iconClass: 'bg-purple-100 text-purple-600', accent: 'border-l-purple-500'  },
    { icon: CheckCircle2,  label: 'Resolved by Agents', value: stats?.resolvedByAgents ?? 0, iconClass: 'bg-green-100 text-green-600',  accent: 'border-l-emerald-500' },
    { icon: AlertTriangle, label: 'Critical Tickets',   value: stats?.critical         ?? 0, iconClass: 'bg-red-100 text-red-600',      accent: 'border-l-red-500'     },
  ]

  return (
    <div className="space-y-6">
      {/* Activity chart */}
      {chartPending ? (
        <ChartSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Activity — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartPoints} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  {Object.entries(CHART_COLORS).map(([key, color]) => (
                    <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.08} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} cursor={{ stroke: '#e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Area dataKey="Received"             type="monotone" stroke={CHART_COLORS.received}         strokeWidth={2} fill="url(#fill-received)"         dot={false} activeDot={{ r: 4 }} />
                <Area dataKey="Resolved"             type="monotone" stroke={CHART_COLORS.resolved}         strokeWidth={2} fill="url(#fill-resolved)"         dot={false} activeDot={{ r: 4 }} />
                <Area dataKey="Resolved by AI"       type="monotone" stroke={CHART_COLORS.resolvedByAI}    strokeWidth={2} fill="url(#fill-resolvedByAI)"    dot={false} activeDot={{ r: 4 }} />
                <Area dataKey="Resolved by Agents"   type="monotone" stroke={CHART_COLORS.resolvedByAgents} strokeWidth={2} fill="url(#fill-resolvedByAgents)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statsPending
          ? <StatSkeletons count={5} />
          : statCards.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* New Tickets */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-900">New Tickets</h2>
        <TicketSlideshow
          tickets={stats?.openTickets ?? []}
          isPending={statsPending}
          emptyMessage="No open tickets at the moment."
        />
      </div>

      {/* Online Agents */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Online Agents</h2>
        <OnlineAgentsList
          agents={stats?.onlineAgents ?? []}
          isPending={statsPending}
        />
      </div>
    </div>
  )
}

// ─── Agent dashboard ──────────────────────────────────────────────────────────

function AgentDashboard({ userId }: { userId: string }) {
  const viewedIds = getRecentViewIds(userId)

  const { data: statsData, isPending: statsPending } = useQuery<AgentStats>({
    queryKey: ['ticketStats'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tickets/stats')
      return data
    },
  })

  const { data: chart, isPending: chartPending } = useQuery<AgentChartData>({
    queryKey: ['ticketChart', 'agent'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tickets/chart')
      return data
    },
  })

  const { data: recentViewed = [], isPending: recentPending } = useQuery<TicketCard[]>({
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
    { icon: Ticket,       label: 'Total Tickets',    value: statsData?.total          ?? 0, iconClass: 'bg-blue-100 text-blue-600',    accent: 'border-l-cyan-500'    },
    { icon: Inbox,        label: 'New Tickets',       value: statsData?.new            ?? 0, iconClass: 'bg-indigo-100 text-indigo-600', accent: 'border-l-indigo-500'  },
    { icon: Clock,        label: 'Ongoing Tickets',   value: statsData?.ongoing        ?? 0, iconClass: 'bg-amber-100 text-amber-600',  accent: 'border-l-amber-500'   },
    { icon: CheckCircle2, label: 'Resolved / Closed', value: statsData?.resolvedClosed ?? 0, iconClass: 'bg-green-100 text-green-600',  accent: 'border-l-emerald-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Line chart */}
      {chartPending ? (
        <ChartSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Your Ticket Activity — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartPoints} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fill-rcv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.received} stopOpacity={0.08} />
                    <stop offset="95%" stopColor={CHART_COLORS.received} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fill-res" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.resolved} stopOpacity={0.08} />
                    <stop offset="95%" stopColor={CHART_COLORS.resolved} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  cursor={{ stroke: '#e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Area dataKey="Received"           type="monotone" stroke={CHART_COLORS.received} strokeWidth={2} fill="url(#fill-rcv)" dot={false} activeDot={{ r: 4 }} />
                <Area dataKey="Resolved / Closed"  type="monotone" stroke={CHART_COLORS.resolved} strokeWidth={2} fill="url(#fill-res)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statsPending
          ? <StatSkeletons count={4} />
          : statCards.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-900">New Tickets</h2>
        <TicketSlideshow
          tickets={statsData?.openTickets ?? []}
          isPending={statsPending}
          emptyMessage="No open tickets assigned to you."
        />
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Recent Tickets</h2>
        <TicketSlideshow
          tickets={viewedIds.length === 0 ? [] : recentViewed}
          isPending={viewedIds.length > 0 && recentPending}
          emptyMessage="No recently viewed tickets."
        />
      </div>
    </div>
  )
}

// ─── Agent settings modal ─────────────────────────────────────────────────────

function AgentSettingsModal({
  user,
  onClose,
}: {
  user: { id: string; name: string; email: string }
  onClose: () => void
}) {
  const [password, setPassword]       = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)

  const handleSave = async () => {
    setError(null)
    setSuccess(false)
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setSaving(true)
    try {
      await axios.patch('/api/users/me', { password })
      setSuccess(true)
      setPassword('')
      setShowPw(false)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Name</p>
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Email</p>
            <p className="text-sm text-gray-700">{user.email}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <Label htmlFor="settings-pw" className="text-sm font-medium text-gray-700">Change Password</Label>
          <div className="relative">
            <Input
              id="settings-pw"
              type={showPw ? 'text' : 'password'}
              placeholder="New password (min 8 chars)"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); setSuccess(false) }}
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
          {error   && <p className="text-xs text-red-600">{error}</p>}
          {success && <p className="text-xs text-green-600">Password updated successfully.</p>}
          <Button className="w-full" onClick={handleSave} disabled={saving || !password}>
            {saving ? 'Saving…' : 'Update Password'}
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

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {session?.user.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{session?.user.email}</p>
          </div>
          {!isAdmin && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          )}
        </div>

        {sessionPending ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : isAdmin ? (
          <AdminDashboard />
        ) : (
          <AgentDashboard userId={userId} />
        )}
      </main>

      {settingsOpen && user && (
        <AgentSettingsModal
          user={{ id: userId, name: user.name ?? '', email: user.email ?? '' }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
