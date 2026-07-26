import { useState, useEffect, type ElementType } from 'react'
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
import { authClient } from '../lib/auth-client'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { StatusBadge, type TicketStatus } from '../components/ui/status-badge'
import { PriorityBadge, type TicketPriority } from '../components/ui/priority-badge'
import { CategoryBadge, type TicketCategory } from '../components/ui/category-badge'
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
  UserRound,
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
  status: TicketStatus
  priority: TicketPriority | null
  category?: TicketCategory | null
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
  received:         'var(--status-open)',
  resolved:         'var(--status-resolved)',
  resolvedByAI:     'var(--status-ai-resolved)',
  resolvedByAgents: 'var(--primary)',
}

const ADMIN_CHART_SERIES: ChartSeries[] = [
  { key: 'Received', color: CHART_COLORS.received, gradient: 'admin-received' },
  { key: 'Resolved', color: CHART_COLORS.resolved, gradient: 'admin-resolved' },
  { key: 'Resolved by AI', color: CHART_COLORS.resolvedByAI, gradient: 'admin-ai' },
  { key: 'Resolved by Agents', color: CHART_COLORS.resolvedByAgents, gradient: 'admin-agents' },
]

const AGENT_CHART_SERIES: ChartSeries[] = [
  { key: 'Received', color: CHART_COLORS.received, gradient: 'agent-received' },
  { key: 'Resolved / Closed', color: CHART_COLORS.resolved, gradient: 'agent-resolved' },
]

function shareOf(value: number, total: number) {
  if (total === 0) return 'No tickets yet'
  return `${Math.round((value / total) * 100)}% of total`
}

// ─── Ticket slideshow ─────────────────────────────────────────────────────────

const PAGE_SIZE = 2

const ticketRail: Record<TicketPriority, string> = {
  LOW: 'before:bg-muted-foreground/45',
  MEDIUM: 'before:bg-status-inprogress',
  HIGH: 'before:bg-status-danger',
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  return prefersReducedMotion
}

function ticketTimestamp(ticket: TicketCard) {
  const value = ticket.last_updated_at ?? ticket.created_at
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function TicketSlideshow({
  tickets,
  isPending,
  isError = false,
  onRetry,
  emptyMessage,
}: {
  tickets: TicketCard[]
  isPending: boolean
  isError?: boolean
  onRetry?: () => void
  emptyMessage: string
}) {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE))

  useEffect(() => { setPage(0) }, [tickets.length])

  useEffect(() => {
    if (paused || prefersReducedMotion || totalPages <= 1) return
    const id = setInterval(() => {
      setPage(prev => (prev + 1) % totalPages)
    }, 4000)
    return () => clearInterval(id)
  }, [paused, prefersReducedMotion, totalPages])

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Loading tickets">
        {Array.from({ length: PAGE_SIZE }).map((_, index) => (
          <Card key={index} size="sm" className="min-h-36">
            <CardHeader className="gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-4/5" />
            </CardHeader>
            <CardContent className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        className="min-h-36"
        title="Tickets unavailable"
        description="The latest ticket queue could not be loaded."
        action={onRetry ? <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button> : undefined}
      />
    )
  }

  if (tickets.length === 0) {
    return <EmptyState className="min-h-36" title={emptyMessage} />
  }

  const safePage = page % totalPages
  const visible = tickets.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div
      className="flex flex-col items-center"
      aria-label="Ticket carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map(ticket => (
          <Card
            key={ticket.id}
            size="sm"
            className={`relative min-h-40 overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-1 ${ticket.priority ? ticketRail[ticket.priority] : 'before:bg-status-open'}`}
          >
            <CardHeader className="gap-3 pl-5">
              <div className="flex items-center justify-between gap-3">
                <span className="tabular truncate text-caption text-muted-foreground">
                  #{ticket.id.slice(0, 8)}
                </span>
                <StatusBadge status={ticket.status} />
              </div>
              <a
                href={`/tickets/${ticket.id}`}
                onClick={(event) => {
                  event.preventDefault()
                  navigate(`/tickets/${ticket.id}`)
                }}
                className="line-clamp-2 text-body-lg font-semibold leading-snug tracking-tight text-foreground outline-none transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                {ticket.subject}
              </a>
            </CardHeader>
            <CardContent className="mt-auto pl-5">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-label font-medium text-foreground">{ticket.customer_name}</p>
                  <p className="tabular mt-0.5 text-caption text-muted-foreground">Updated {ticketTimestamp(ticket)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {ticket.category ? <CategoryBadge category={ticket.category} /> : null}
                  {ticket.priority ? (
                    <>
                      <PriorityBadge priority={ticket.priority} aria-hidden="true" />
                      <span className="sr-only">{ticket.priority} priority</span>
                    </>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2" aria-label="Ticket pages">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous ticket page"
            onClick={() => setPage(prev => (prev - 1 + totalPages) % totalPages)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to ticket page ${i + 1}`}
                aria-current={i === safePage ? 'page' : undefined}
                onClick={() => setPage(i)}
                className={`size-2 rounded-full outline-none transition-[background-color,transform] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${i === safePage ? 'scale-110 bg-primary' : 'bg-border hover:bg-muted-foreground/60'}`}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next ticket page"
            onClick={() => setPage(prev => (prev + 1) % totalPages)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
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
  detail,
  tone,
  accent,
}: {
  icon: ElementType
  label: string
  value: number
  detail: string
  tone: string
  accent: string
}) {
  return (
    <Card size="sm" className={`relative min-h-32 before:absolute before:inset-y-0 before:left-0 before:w-1 ${accent}`}>
      <CardHeader className="flex-row items-start justify-between gap-3 pl-5">
        <p className="text-caption font-medium text-muted-foreground">{label}</p>
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="mt-auto pl-5">
        <p className="tabular text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-foreground">{value}</p>
        <p className="mt-2 text-caption text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

// ─── Stat skeleton row ────────────────────────────────────────────────────────

function StatSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} size="sm" className="min-h-32">
          <CardHeader className="flex-row justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-8 rounded-lg" />
          </CardHeader>
          <CardContent className="mt-auto space-y-2">
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </>
  )
}

// ─── Chart skeleton ───────────────────────────────────────────────────────────

function ChartSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-body-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-56 w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

type ChartSeries = {
  key: string
  color: string
  gradient: string
}

function ActivityChart({
  title,
  description,
  data,
  series,
}: {
  title: string
  description: string
  data: Array<Record<string, string | number>>
  series: ChartSeries[]
}) {
  const totalReceived = data.reduce((sum, point) => sum + Number(point.Received ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-body-lg font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 text-caption text-muted-foreground">{description}</p>
          </div>
          <p className="tabular text-caption text-muted-foreground">
            <span className="font-semibold text-foreground">{totalReceived}</span> received
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div
          role="img"
          aria-label={`${title}. ${totalReceived} tickets received across the last 30 days.`}
          className="h-60 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                {series.map(item => (
                  <linearGradient key={item.gradient} id={item.gradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={item.color} stopOpacity={0.16} />
                    <stop offset="95%" stopColor={item.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="2 5" stroke="var(--border)" strokeOpacity={0.75} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-geist-mono)' }}
                tickLine={false}
                axisLine={false}
                interval={4}
                tickMargin={10}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-geist-mono)' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--popover)',
                  color: 'var(--popover-foreground)',
                  boxShadow: 'var(--elevation-e2)',
                  fontFamily: 'var(--font-geist-mono)',
                  fontSize: 12,
                  fontVariantNumeric: 'tabular-nums',
                }}
                labelStyle={{ color: 'var(--muted-foreground)', marginBottom: 6 }}
                cursor={{ stroke: 'var(--border)' }}
              />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, paddingTop: 14 }} />
              {series.map(item => (
                <Area
                  key={item.key}
                  dataKey={item.key}
                  type="monotone"
                  stroke={item.color}
                  strokeWidth={2}
                  fill={`url(#${item.gradient})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Online agents list ───────────────────────────────────────────────────────

const agentStatusDot: Record<string, string> = {
  ONLINE:  'bg-status-resolved',
  AWAY:    'bg-status-inprogress',
  MEETING: 'bg-status-danger',
}

const agentStatusLabel: Record<string, string> = {
  ONLINE:  'Online',
  AWAY:    'Away',
  MEETING: 'Meeting',
}

function OnlineAgentsList({
  agents,
  isPending,
  isError,
  onRetry,
}: {
  agents: OnlineAgent[]
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-xl" />)}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        className="min-h-36"
        title="Agent presence unavailable"
        description="Current agent availability could not be loaded."
        action={<Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
      />
    )
  }

  if (agents.length === 0) {
    return <EmptyState className="min-h-36" title="No agents are currently online." icon={<UserRound aria-hidden="true" className="size-5" />} />
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {agents.map(agent => (
        <div
          key={agent.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-e1"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-label font-semibold text-foreground">
            {agent.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-label font-semibold text-foreground">{agent.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-caption text-muted-foreground">
              <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${agentStatusDot[agent.online_status] ?? 'bg-muted-foreground'}`} />
              {agentStatusLabel[agent.online_status]}
            </p>
          </div>
          <span className="ml-auto hidden truncate text-caption text-muted-foreground sm:block">{agent.email}</span>
        </div>
      ))}
    </div>
  )
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
        <OnlineAgentsList
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
