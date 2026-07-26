import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { trackRecentView } from '../lib/recentViews'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, Brain, Sparkles, User } from 'lucide-react'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { StatusBadge, type TicketStatus } from '@/components/ui/status-badge'
import { PriorityBadge, type TicketPriority } from '@/components/ui/priority-badge'
import { CategoryBadge, type TicketCategory } from '@/components/ui/category-badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { authClient } from '../lib/auth-client'

type Priority = TicketPriority
type SenderType = 'CUSTOMER' | 'AGENT' | 'AI'

type Agent = { id: string; name: string; email: string }

type Message = {
  id: string
  body: string
  sender_type: SenderType
  sent_at: string
}

type TicketDetail = {
  id: string
  subject: string
  customer_name: string
  customer_email: string
  status: TicketStatus
  priority: Priority | null
  category: TicketCategory | null
  created_at: string
  assigned_to: { id: string; name: string } | null
  is_ai_handled: boolean
  messages: Message[]
  summary: string | null
}

type HumanStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type PatchBody = {
  status?: HumanStatus
  priority?: Priority | null
  category?: TicketCategory | null
  assigned_to_id?: string | null
}

async function fetchTicket(id: string): Promise<TicketDetail> {
  const { data } = await axios.get<TicketDetail>(`/api/tickets/${id}`)
  return data
}

async function fetchAgents(): Promise<Agent[]> {
  const { data } = await axios.get<Agent[]>('/api/users/agents')
  return data
}

const statusLabels: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  AI_PROCESSING: 'AI Processing',
  AI_RESOLVED: 'AI Resolved',
}

const senderStyles: Record<SenderType, { bubble: string; label: string; align: string; avatar: string }> = {
  CUSTOMER: { bubble: 'border-border bg-card text-foreground', label: 'Customer', align: 'items-start', avatar: 'bg-status-open-soft text-status-open' },
  AGENT: { bubble: 'border-primary/15 bg-primary/10 text-foreground', label: 'Agent', align: 'items-end', avatar: 'bg-primary/10 text-primary' },
  AI: { bubble: 'border-status-ai-resolved/15 bg-status-ai-resolved-soft text-foreground', label: 'AI', align: 'items-end', avatar: 'bg-status-ai-resolved-soft text-status-ai-resolved' },
}

const statusRail: Record<TicketStatus, string> = {
  OPEN: 'border-l-status-open',
  IN_PROGRESS: 'border-l-status-inprogress',
  RESOLVED: 'border-l-status-resolved',
  CLOSED: 'border-l-status-resolved',
  AI_PROCESSING: 'border-l-status-ai-resolved',
  AI_RESOLVED: 'border-l-status-ai-resolved',
}

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-card px-3 text-label text-foreground shadow-e1 outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 motion-reduce:transition-none'

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: session } = authClient.useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN'

  const { data: ticket, isPending, error, refetch } = useQuery({
    queryKey: ['tickets', id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
    meta: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets', 'stats'] }) },
  })

  useEffect(() => {
    if (ticket) queryClient.invalidateQueries({ queryKey: ['tickets', 'stats'] })
  }, [ticket?.id, ticket?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    enabled: isAdmin,
  })

  // Update panel state — seeded from ticket once loaded
  const [status,      setStatus]      = useState<HumanStatus | ''>('')
  const [priority,    setPriority]    = useState<Priority | ''>('')
  const [category,    setCategory]    = useState<TicketCategory | ''>('')
  const [assignedToId, setAssignedToId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Reply state — draft persisted in localStorage so navigation doesn't wipe it
  const draftKey = `reply-draft-${id}`
  const [replyBody,    setReplyBody]    = useState(() => localStorage.getItem(`reply-draft-${id}`) ?? '')
  const [replyError,   setReplyError]   = useState<string | null>(null)
  const [isPolishing,    setIsPolishing]    = useState(false)
  const [polishError,    setPolishError]    = useState<string | null>(null)

  // Summary state
  const [summary,        setSummary]        = useState<string | null>(null)
  const [isSummarizing,  setIsSummarizing]  = useState(false)
  const [summaryError,   setSummaryError]   = useState<string | null>(null)

  // Agent modal (admin only)
  const [agentModal, setAgentModal] = useState(false)

  // Seed dropdowns when ticket loads / changes
  useEffect(() => {
    if (ticket) {
      const humanStatuses: HumanStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
      setStatus(humanStatuses.includes(ticket.status as HumanStatus) ? ticket.status as HumanStatus : '')
      setPriority(ticket.priority ?? '')
      setCategory(ticket.category ?? '')
      setAssignedToId(ticket.assigned_to?.id ?? null)
      setSummary(ticket.summary ?? null)
    }
  }, [ticket?.id])

  // Track this ticket as recently viewed
  useEffect(() => {
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (ticket && userId) {
      trackRecentView(userId, ticket.id)
    }
  }, [ticket?.id, (session?.user as { id?: string } | undefined)?.id])

  const mutation = useMutation({
    mutationFn: (body: PatchBody) =>
      axios.patch<TicketDetail>(`/api/tickets/${id}`, body).then(r => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['tickets', id], updated)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      const humanStatuses: HumanStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
      setStatus(humanStatuses.includes(updated.status as HumanStatus) ? updated.status as HumanStatus : '')
      setPriority(updated.priority ?? '')
      setCategory(updated.category ?? '')
      setAssignedToId(updated.assigned_to?.id ?? null)
      setUpdateError(null)
    },
    onError: (err: any) => {
      setUpdateError(err?.response?.data?.error ?? 'Update failed')
    },
  })

  const replyMutation = useMutation({
    mutationFn: (body: string) =>
      axios.post(`/api/tickets/${id}/messages`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', id] })
      localStorage.removeItem(draftKey)
      setReplyBody('')
      setReplyError(null)
    },
    onError: (err: any) => {
      setReplyError(err?.response?.data?.error ?? 'Failed to send reply')
    },
  })

  const handlePolish = async () => {
    if (!replyBody.trim()) return
    setIsPolishing(true)
    setPolishError(null)
    try {
      const { data } = await axios.post<{ polished: string }>(`/api/tickets/${id}/polish`, { body: replyBody.trim() })
      setReplyBody(data.polished)
      localStorage.setItem(draftKey, data.polished)
    } catch (err: any) {
      setPolishError(err?.response?.data?.error ?? 'Failed to polish reply')
    } finally {
      setIsPolishing(false)
    }
  }

  const handleSummarize = async () => {
    setIsSummarizing(true)
    setSummaryError(null)
    try {
      const { data } = await axios.post<{ summary: string }>(`/api/tickets/${id}/summarize`)
      setSummary(data.summary)
    } catch (err: any) {
      setSummaryError(err?.response?.data?.error ?? 'Failed to generate summary')
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleUpdate = () => {
    const closingOrResolving = status === 'CLOSED' || status === 'RESOLVED'
    if (closingOrResolving && !category) {
      setUpdateError('A category is required before closing or resolving a ticket.')
      return
    }
    const body: PatchBody = {
      ...(status && { status }),
      priority: closingOrResolving ? null : (priority as Priority) || null,
      category: (category as TicketCategory) || null,
      assigned_to_id: assignedToId,
    }
    mutation.mutate(body)
  }

  const nothingChanged = !ticket
    || ((!status || status === ticket.status)
     && priority === (ticket.priority ?? '')
     && category === (ticket.category ?? '')
     && assignedToId === (ticket.assigned_to?.id ?? null))

  return (
    <div>
      <div className="mx-auto max-w-7xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/tickets')}
          className="mb-4 -ml-2 text-muted-foreground"
        >
          <ArrowLeft aria-hidden="true" />
          Back to Tickets
        </Button>

        {isPending && (
          <div className="space-y-5" aria-label="Loading ticket">
            <Card className="border-l-4 border-l-transparent">
              <CardHeader className="space-y-3">
                <Skeleton className="h-7 w-2/3" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
            </Card>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <Card>
                <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-24 w-4/5 rounded-xl" />
                  <Skeleton className="ml-auto h-20 w-3/5 rounded-xl" />
                </CardContent>
              </Card>
              <div className="space-y-4">
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-56 w-full rounded-xl" />
              </div>
            </div>
          </div>
        )}

        {error ? (
          <ErrorState
            title="Ticket unavailable"
            description={error.message}
            action={<Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button>}
          />
        ) : null}

        {ticket && (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">

            {/* ── Left: header + thread + reply ── */}
            <div className="space-y-6">

              {/* Header */}
              <Card className={`border-l-4 ${statusRail[ticket.status]}`}>
                <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="tabular mb-2 text-caption text-muted-foreground">#{ticket.id}</div>
                    <h1 className="text-h2 font-semibold tracking-tight text-foreground">{ticket.subject}</h1>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <StatusBadge status={ticket.status} />
                    {ticket.priority ? <PriorityBadge priority={ticket.priority} /> : null}
                    {ticket.category ? <CategoryBadge category={ticket.category} /> : null}
                  </div>
                </CardHeader>
                <CardContent className="border-t border-border pt-4 text-caption text-muted-foreground">
                  <span className="tabular">Opened {new Date(ticket.created_at).toLocaleString()}</span>
                </CardContent>
              </Card>

              {/* Thread */}
              <Card>
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-body-lg font-semibold tracking-tight text-foreground">Thread ({ticket.messages.length})</h2>
                    <span className="text-caption text-muted-foreground">Conversation history</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {ticket.messages.length === 0 ? (
                    <EmptyState className="min-h-40 border-0 bg-transparent" title="No messages yet." />
                  ) : (
                    <ol aria-label="Conversation thread" className="max-h-[560px] space-y-5 overflow-y-auto pr-1">
                      {ticket.messages.map((msg) => {
                        const style = senderStyles[msg.sender_type]
                        return (
                          <li key={msg.id} className={`flex flex-col ${style.align}`}>
                            <div className={`mb-1.5 flex items-center gap-2 ${msg.sender_type === 'CUSTOMER' ? '' : 'flex-row-reverse'}`}>
                              <span className={`flex size-7 items-center justify-center rounded-full ${style.avatar}`}>
                                {msg.sender_type === 'AI' ? <Brain aria-hidden="true" className="size-3.5" /> : <User aria-hidden="true" className="size-3.5" />}
                              </span>
                              <span className="text-caption font-medium text-foreground">{style.label}</span>
                            </div>
                            <article className={`max-w-[88%] rounded-xl border px-4 py-3 shadow-e1 sm:max-w-[78%] ${style.bubble}`}>
                              <ReactMarkdown
                                components={{
                                  a: ({ children, ...props }) => <a {...props} className="font-medium text-primary underline underline-offset-2">{children}</a>,
                                  p: ({ children }) => <p className="whitespace-pre-wrap text-body leading-relaxed last:mb-0">{children}</p>,
                                  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-body">{children}</ul>,
                                  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-body">{children}</ol>,
                                }}
                              >
                                {msg.body}
                              </ReactMarkdown>
                            </article>
                            <time dateTime={msg.sent_at} className="tabular mt-1.5 px-1 text-caption text-muted-foreground">
                              {new Date(msg.sent_at).toLocaleString()}
                            </time>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>

              {/* Reply — agents only */}
              {!isAdmin && (
                <Card>
                  <CardHeader className="border-b border-border pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-body-lg font-semibold tracking-tight text-foreground">Reply</h2>
                      <span className="text-caption text-muted-foreground">Draft saved locally</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <label htmlFor="ticket-reply" className="sr-only">Reply message</label>
                    <textarea
                      id="ticket-reply"
                      value={replyBody}
                      onChange={e => { setReplyBody(e.target.value); localStorage.setItem(draftKey, e.target.value) }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && replyBody.trim()) {
                          replyMutation.mutate(replyBody.trim())
                        }
                      }}
                      placeholder="Write your reply…"
                      rows={6}
                      className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-body text-foreground shadow-inner outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 motion-reduce:transition-none"
                    />
                    {replyError ? <p role="alert" className="mt-2 text-label text-status-danger">{replyError}</p> : null}
                    {polishError ? <p role="alert" className="mt-2 text-label text-status-danger">{polishError}</p> : null}
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="tabular text-caption text-muted-foreground">Ctrl + Enter to send</p>
                      <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        loading={isPolishing}
                        onClick={handlePolish}
                        disabled={isPolishing || replyMutation.isPending || !replyBody.trim()}
                      >
                        <Sparkles aria-hidden="true" />
                        {isPolishing ? 'Polishing…' : 'Polish'}
                      </Button>
                      <Button
                        loading={replyMutation.isPending}
                        onClick={() => replyMutation.mutate(replyBody.trim())}
                        disabled={replyMutation.isPending || isPolishing || !replyBody.trim()}
                      >
                        {replyMutation.isPending ? 'Sending…' : 'Send Reply'}
                      </Button>
                    </div>
                  </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Right: update panel + summary ── */}
            <aside aria-label="Ticket details" className="space-y-4 lg:sticky lg:top-20">
            <Card size="sm" className={`border-l-4 ${statusRail[ticket.status]}`}>
              <CardHeader>
                <h2 className="text-body-lg font-semibold tracking-tight text-foreground">Ticket Details</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={ticket.status} />
                  {ticket.priority ? <PriorityBadge priority={ticket.priority} /> : null}
                  {ticket.category ? <CategoryBadge category={ticket.category} /> : null}
                </div>
                <dl className="space-y-3 border-t border-border pt-4">
                  <div>
                    <dt className="text-caption text-muted-foreground">Customer</dt>
                    <dd className="mt-0.5 text-label font-medium text-foreground">{ticket.customer_name}</dd>
                    <dd className="mt-0.5 truncate text-caption text-muted-foreground">
                      <a href={`mailto:${ticket.customer_email}`} className="rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{ticket.customer_email}</a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">Assigned to</dt>
                    <dd className="mt-0.5 text-label font-medium text-foreground">{ticket.assigned_to?.name ?? 'Unassigned'}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">Opened</dt>
                    <dd className="tabular mt-0.5 text-caption text-foreground">{new Date(ticket.created_at).toLocaleString()}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <h2 className="text-body-lg font-semibold tracking-tight text-foreground">Update Ticket</h2>
              </CardHeader>
              <CardContent className="space-y-4">

              {/* Agent — admin only, button opens modal; selection is staged until Save Changes */}
              {isAdmin && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-caption font-medium text-muted-foreground">Agent</span>
                  <Button
                    variant="outline"
                    onClick={() => setAgentModal(true)}
                    className="w-full justify-start overflow-hidden"
                  >
                    {(() => {
                      if (!assignedToId) {
                        return <span className="text-muted-foreground">Unassigned</span>
                      }
                      const pendingAgent = agents.find(a => a.id === assignedToId)
                      if (pendingAgent) {
                        return <><User aria-hidden="true" className="text-muted-foreground" /><span className="truncate">{pendingAgent.name}</span></>
                      }
                      // ID set but not in agents list → AI agent
                      return <><Brain aria-hidden="true" className="text-status-ai-resolved" /><span className="truncate">{ticket.assigned_to?.name ?? 'AI Agent'}</span></>
                    })()}
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="td-status" className="text-caption font-medium text-muted-foreground">Status</label>
                <select
                  id="td-status"
                  value={status}
                  onChange={e => setStatus(e.target.value as HumanStatus)}
                  className={selectClass}
                >
                  {!status && (
                    <option value="" disabled>
                      {statusLabels[ticket.status]} — select to override
                    </option>
                  )}
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="td-priority" className="text-caption font-medium text-muted-foreground">Priority</label>
                <select
                  id="td-priority"
                  value={priority}
                  onChange={e => setPriority(e.target.value as Priority | '')}
                  className={selectClass}
                >
                  <option value="">None</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="td-category" className="text-caption font-medium text-muted-foreground">Category</label>
                <select
                  id="td-category"
                  value={category}
                  onChange={e => setCategory(e.target.value as TicketCategory | '')}
                  className={selectClass}
                >
                  <option value="">None</option>
                  <option value="ACCOUNT">Account</option>
                  <option value="INQUIRY">Inquiry</option>
                  <option value="PAYMENT">Payments</option>
                  <option value="DELIVERY">Delivery</option>
                  <option value="MENU">Menu</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="VOUCHER">Voucher</option>
                  <option value="OTHER">Others</option>
                </select>
              </div>

              {updateError ? <p role="alert" className="text-label text-status-danger">{updateError}</p> : null}

              <Button
                loading={mutation.isPending}
                onClick={handleUpdate}
                disabled={mutation.isPending || nothingChanged}
                className="w-full"
              >
                {mutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
              </CardContent>
            </Card>

            {/* Summary — agents only */}
            {!isAdmin && (
              <Card size="sm">
                <CardHeader>
                  <h2 className="text-body-lg font-semibold tracking-tight text-foreground">Ticket Summary</h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary ? (
                    <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{summary}</p>
                  ) : (
                    <p className="text-body text-muted-foreground">No summary generated yet.</p>
                  )}
                  {summaryError ? <p role="alert" className="text-label text-status-danger">{summaryError}</p> : null}
                  <Button
                    variant="outline"
                    loading={isSummarizing}
                    className="w-full"
                    onClick={handleSummarize}
                    disabled={isSummarizing}
                  >
                    <Sparkles aria-hidden="true" />
                    {isSummarizing ? 'Summarizing…' : summary ? 'Regenerate Summary' : 'Generate Summary'}
                  </Button>
                </CardContent>
              </Card>
            )}
            </aside>

          </div>
        )}
      </div>

      {/* Agent assignment modal */}
      {agentModal && ticket && (
        <Dialog open onOpenChange={(open) => { if (!open) setAgentModal(false) }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{ticket.assigned_to ? 'Re-assign Agent' : 'Assign Agent'}</DialogTitle>
              <DialogDescription>Select who should own this ticket, then save the ticket changes.</DialogDescription>
            </DialogHeader>

            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {assignedToId ? (
                <Button variant="ghost" onClick={() => { setAssignedToId(null); setAgentModal(false) }} className="h-auto w-full justify-start px-3 py-2.5 text-left">
                  <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"><User aria-hidden="true" /></span>
                  <span><span className="block text-label font-semibold">Unassigned</span><span className="block text-caption font-normal text-muted-foreground">Remove current assignment</span></span>
                </Button>
              ) : null}
              {agents.length === 0 ? <EmptyState className="min-h-36" title="No agents available." icon={<User aria-hidden="true" className="size-5" />} /> : null}
              {agents.map(agent => (
                <Button
                  key={agent.id}
                  variant="ghost"
                  onClick={() => { setAssignedToId(agent.id); setAgentModal(false) }}
                  className="h-auto w-full justify-start px-3 py-2.5 text-left"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-muted text-caption font-semibold text-foreground">{agent.name.trim().charAt(0).toUpperCase()}</span>
                  <span className="min-w-0"><span className="block truncate text-label font-semibold">{agent.name}</span><span className="block truncate text-caption font-normal text-muted-foreground">{agent.email}</span></span>
                </Button>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAgentModal(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
