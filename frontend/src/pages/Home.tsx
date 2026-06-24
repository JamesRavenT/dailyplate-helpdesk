import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import Navbar from '../components/Navbar'
import { authClient } from '../lib/auth-client'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { getRecentViewIds } from '../lib/recentViews'
import {
  Ticket,
  Clock,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type AdminStats = {
  total: number
  ongoing: number
  resolvedByAI: number
  resolvedByAgents: number
  critical: number
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

type AgentStats = {
  total: number
  ongoing: number
  resolved: number
  openTickets: TicketCard[]
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
  AI_RESOLVED: 'bg-purple-100 text-purple-700',
  AI_PROCESSING: 'bg-indigo-100 text-indigo-700',
}

const statusLabels: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  AI_RESOLVED: 'AI Resolved',
  AI_PROCESSING: 'AI Processing',
}

const priorityColors: Record<string, string> = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-amber-600',
  HIGH: 'text-red-600',
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: React.ElementType
  label: string
  value: number
  iconClass: string
}) {
  return (
    <Card>
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
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  // Reset index when the ticket list changes
  useEffect(() => {
    setCurrent(0)
  }, [tickets.length])

  useEffect(() => {
    if (paused || tickets.length <= 1) return
    const id = setInterval(() => {
      setCurrent(prev => (prev + 1) % tickets.length)
    }, 4000)
    return () => clearInterval(id)
  }, [paused, tickets.length])

  const idx = tickets.length > 0 ? current % tickets.length : 0

  if (isPending) return <Skeleton className="h-32 w-full rounded-xl" />

  if (tickets.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div
      className="relative max-w-lg"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="cursor-pointer"
        onClick={() => navigate(`/tickets/${tickets[idx].id}`)}
      >
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="line-clamp-2 text-sm font-medium leading-snug">
                {tickets[idx].subject}
              </CardTitle>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[tickets[idx].status] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {statusLabels[tickets[idx].status] ?? tickets[idx].status}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{tickets[idx].customer_name}</p>
            {tickets[idx].priority && (
              <p className={`mt-1 text-xs font-medium ${priorityColors[tickets[idx].priority!] ?? ''}`}>
                {tickets[idx].priority} priority
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {tickets.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrent(prev => (prev - 1 + tickets.length) % tickets.length)}
            className="rounded-full p-1 text-gray-400 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {tickets.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 w-2 rounded-full transition-colors ${i === idx ? 'bg-gray-800' : 'bg-gray-300 hover:bg-gray-500'}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrent(prev => (prev + 1) % tickets.length)}
            className="rounded-full p-1 text-gray-400 hover:text-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function AdminDashboard() {
  const navigate = useNavigate()
  const { data, isPending } = useQuery<AdminStats>({
    queryKey: ['ticketStats'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tickets/stats')
      return data
    },
  })

  const stats = [
    { icon: Ticket,       label: 'Total Tickets',       value: data?.total ?? 0,            iconClass: 'bg-blue-100 text-blue-600'   },
    { icon: Clock,        label: 'Ongoing Tickets',      value: data?.ongoing ?? 0,          iconClass: 'bg-amber-100 text-amber-600' },
    { icon: Brain,        label: 'Resolved by AI',       value: data?.resolvedByAI ?? 0,     iconClass: 'bg-purple-100 text-purple-600' },
    { icon: CheckCircle2, label: 'Resolved by Agents',   value: data?.resolvedByAgents ?? 0, iconClass: 'bg-green-100 text-green-600' },
    { icon: AlertTriangle,label: 'Critical Tickets',     value: data?.critical ?? 0,         iconClass: 'bg-red-100 text-red-600'     },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {isPending
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="mt-2 h-8 w-12" /></CardContent>
              </Card>
            ))
          : stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="flex gap-3">
        <Button onClick={() => navigate('/tickets')}>
          <Ticket className="h-4 w-4" />
          View Tickets
        </Button>
        <Button variant="outline" onClick={() => navigate('/users')}>
          <Users className="h-4 w-4" />
          Manage Users
        </Button>
      </div>
    </div>
  )
}

function AgentDashboard({ userId }: { userId: string }) {
  const viewedIds = getRecentViewIds(userId)

  const { data: statsData, isPending: statsPending } = useQuery<AgentStats>({
    queryKey: ['ticketStats'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tickets/stats')
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

  const stats = [
    { icon: Ticket,       label: 'Total Tickets',   value: statsData?.total ?? 0,    iconClass: 'bg-blue-100 text-blue-600'   },
    { icon: Clock,        label: 'Ongoing Tickets',  value: statsData?.ongoing ?? 0,  iconClass: 'bg-amber-100 text-amber-600' },
    { icon: CheckCircle2, label: 'Resolved Tickets', value: statsData?.resolved ?? 0, iconClass: 'bg-green-100 text-green-600' },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statsPending
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="mt-2 h-8 w-12" /></CardContent>
              </Card>
            ))
          : stats.map(s => <StatCard key={s.label} {...s} />)}
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

export default function Home() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const user = session?.user as { role?: string; id?: string } | undefined
  const isAdmin = user?.role === 'ADMIN'
  const userId = user?.id ?? ''

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {session?.user.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{session?.user.email}</p>
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
    </div>
  )
}
