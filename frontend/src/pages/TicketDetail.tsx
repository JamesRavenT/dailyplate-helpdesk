import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowLeft } from 'lucide-react'
import Navbar from '../components/Navbar'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { authClient } from '../lib/auth-client'

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type Priority = 'LOW' | 'MEDIUM' | 'HIGH'
type TicketCategory = 'ACCOUNT' | 'INQUIRY' | 'REFUND' | 'TECHNICAL' | 'VOUCHER' | 'OTHER'
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
  messages: Message[]
}

type PatchBody = {
  status?: TicketStatus
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

const statusStyles: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
}

const statusLabels: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

const senderStyles: Record<SenderType, { bubble: string; label: string; align: string }> = {
  CUSTOMER: { bubble: 'bg-gray-100 text-gray-800', label: 'Customer', align: 'items-start' },
  AGENT:    { bubble: 'bg-blue-600 text-white',    label: 'Agent',    align: 'items-end'   },
  AI:       { bubble: 'bg-purple-100 text-purple-800', label: 'AI',  align: 'items-start' },
}

const categoryLabels: Record<TicketCategory, string> = {
  ACCOUNT:   'Account',
  INQUIRY:   'Inquiry',
  REFUND:    'Refunds',
  TECHNICAL: 'Technical',
  VOUCHER:   'Voucher',
  OTHER:     'Others',
}

const selectClass =
  'w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: session } = authClient.useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN'

  const { data: ticket, isPending, error } = useQuery({
    queryKey: ['tickets', id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    enabled: isAdmin,
  })

  // Update panel state — seeded from ticket once loaded
  const [status,   setStatus]   = useState<TicketStatus | ''>('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [category, setCategory] = useState<TicketCategory | ''>('')
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Reply state
  const [replyBody,  setReplyBody]  = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)

  // Agent modal (admin only)
  const [agentModal, setAgentModal] = useState(false)

  // Seed dropdowns when ticket loads / changes
  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status)
      setPriority(ticket.priority ?? '')
      setCategory(ticket.category ?? '')
    }
  }, [ticket?.id])

  const mutation = useMutation({
    mutationFn: (body: PatchBody) =>
      axios.patch<TicketDetail>(`/api/tickets/${id}`, body).then(r => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['tickets', id], updated)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setStatus(updated.status)
      setPriority(updated.priority ?? '')
      setCategory(updated.category ?? '')
      setUpdateError(null)
    },
    onError: (err: any) => {
      setUpdateError(err?.response?.data?.error ?? 'Update failed')
    },
  })

  const assignMutation = useMutation({
    mutationFn: (agentId: string | null) =>
      axios.patch<TicketDetail>(`/api/tickets/${id}`, { assigned_to_id: agentId }).then(r => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['tickets', id], updated)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setAgentModal(false)
    },
  })

  const replyMutation = useMutation({
    mutationFn: (body: string) =>
      axios.post(`/api/tickets/${id}/messages`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', id] })
      setReplyBody('')
      setReplyError(null)
    },
    onError: (err: any) => {
      setReplyError(err?.response?.data?.error ?? 'Failed to send reply')
    },
  })

  const handleUpdate = () => {
    const body: PatchBody = {
      status: status as TicketStatus,
      priority: (priority as Priority) || null,
      category: (category as TicketCategory) || null,
    }
    mutation.mutate(body)
  }

  const nothingChanged = !ticket
    || (status   === ticket.status
     && priority === (ticket.priority ?? '')
     && category === (ticket.category ?? ''))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate('/tickets')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tickets
        </button>

        {isPending && (
          <div className="grid grid-cols-[1fr_280px] gap-6">
            <div className="space-y-4">
              <Skeleton className="h-7 w-96" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
            <Skeleton className="h-72 w-full rounded-lg" />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error.message}</p>}

        {ticket && (
          <div className="grid grid-cols-[1fr_280px] gap-6 items-start">

            {/* ── Left: header + thread + reply ── */}
            <div className="space-y-6">

              {/* Header */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold text-gray-900 truncate">{ticket.subject}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                      From{' '}
                      <span className="font-medium text-gray-700">{ticket.customer_name}</span>
                      {' '}·{' '}
                      <a href={`mailto:${ticket.customer_email}`} className="hover:underline">
                        {ticket.customer_email}
                      </a>
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[ticket.status]}`}>
                    {statusLabels[ticket.status]}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
                  {ticket.priority && (
                    <span>Priority: <span className="font-medium text-gray-700">{ticket.priority}</span></span>
                  )}
                  {ticket.category && (
                    <span>Category: <span className="font-medium text-gray-700">{categoryLabels[ticket.category]}</span></span>
                  )}
                  <span>Assigned: <span className="font-medium text-gray-700">{ticket.assigned_to?.name ?? 'Unassigned'}</span></span>
                  <span>Opened: <span className="font-medium text-gray-700">{new Date(ticket.created_at).toLocaleString()}</span></span>
                </div>
              </div>

              {/* Thread */}
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">
                  Thread ({ticket.messages.length})
                </h2>
                <div className="space-y-3">
                  {ticket.messages.length === 0 ? (
                    <p className="text-sm text-gray-400">No messages yet.</p>
                  ) : (
                    ticket.messages.map((msg) => {
                      const style = senderStyles[msg.sender_type]
                      return (
                        <div key={msg.id} className={`flex flex-col ${style.align}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${style.bubble}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          </div>
                          <p className="mt-1 text-xs text-gray-400 px-1">
                            {style.label} · {new Date(msg.sent_at).toLocaleString()}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Reply — agents only */}
              {!isAdmin && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h2 className="text-sm font-medium text-gray-700 mb-3">Reply</h2>
                  <textarea
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && replyBody.trim()) {
                        replyMutation.mutate(replyBody.trim())
                      }
                    }}
                    placeholder="Write your reply…"
                    rows={4}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  {replyError && <p className="mt-1.5 text-sm text-red-600">{replyError}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400">Ctrl + Enter to send</p>
                    <Button
                      onClick={() => replyMutation.mutate(replyBody.trim())}
                      disabled={replyMutation.isPending || !replyBody.trim()}
                    >
                      {replyMutation.isPending ? 'Sending…' : 'Send Reply'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: update panel ── */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
              <h2 className="text-sm font-medium text-gray-700">Update Ticket</h2>

              {/* Agent — admin only, button opens modal */}
              {isAdmin && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500">Agent</span>
                  <button
                    onClick={() => setAgentModal(true)}
                    className="w-full text-left text-sm border border-gray-300 rounded-md px-2.5 py-1.5 bg-white hover:bg-gray-50 transition-colors text-gray-800 truncate"
                  >
                    {ticket.assigned_to ? ticket.assigned_to.name : <span className="text-gray-400">Unassigned</span>}
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label htmlFor="td-status" className="text-xs text-gray-500">Status</label>
                <select
                  id="td-status"
                  value={status}
                  onChange={e => setStatus(e.target.value as TicketStatus)}
                  className={selectClass}
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="td-priority" className="text-xs text-gray-500">Priority</label>
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

              <div className="flex flex-col gap-1">
                <label htmlFor="td-category" className="text-xs text-gray-500">Category</label>
                <select
                  id="td-category"
                  value={category}
                  onChange={e => setCategory(e.target.value as TicketCategory | '')}
                  className={selectClass}
                >
                  <option value="">None</option>
                  <option value="ACCOUNT">Account</option>
                  <option value="INQUIRY">Inquiry</option>
                  <option value="REFUND">Refunds</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="VOUCHER">Voucher</option>
                  <option value="OTHER">Others</option>
                </select>
              </div>

              {updateError && <p className="text-sm text-red-600">{updateError}</p>}

              <Button
                onClick={handleUpdate}
                disabled={mutation.isPending || nothingChanged}
                className="w-full"
              >
                {mutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>

          </div>
        )}
      </main>

      {/* Agent assignment modal */}
      {agentModal && ticket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setAgentModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-80 p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              {ticket.assigned_to ? 'Re-assign Agent' : 'Assign Agent'}
            </h2>

            <div className="space-y-1">
              {ticket.assigned_to && (
                <button
                  onClick={() => assignMutation.mutate(null)}
                  disabled={assignMutation.isPending}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <p className="text-sm text-gray-800">Unassigned</p>
                  <p className="text-xs text-gray-400">Remove current assignment</p>
                </button>
              )}
              {agents.length === 0 && (
                <p className="text-sm text-gray-400 px-3 py-2">No agents available.</p>
              )}
              {agents.map(a => (
                <button
                  key={a.id}
                  onClick={() => assignMutation.mutate(a.id)}
                  disabled={assignMutation.isPending}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <p className="text-sm text-gray-800">{a.name}</p>
                  <p className="text-xs text-gray-400">{a.email}</p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setAgentModal(false)}
              className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
