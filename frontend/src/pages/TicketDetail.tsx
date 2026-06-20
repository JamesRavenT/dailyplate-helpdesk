import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowLeft } from 'lucide-react'
import Navbar from '../components/Navbar'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '@/components/ui/button'

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type Priority = 'LOW' | 'MEDIUM' | 'HIGH'
type TicketCategory = 'ACCOUNT' | 'INQUIRY' | 'REFUND' | 'TECHNICAL' | 'VOUCHER' | 'OTHER'
type SenderType = 'CUSTOMER' | 'AGENT' | 'AI'

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

async function fetchTicket(id: string): Promise<TicketDetail> {
  const { data } = await axios.get<TicketDetail>(`/api/tickets/${id}`)
  return data
}

async function patchTicket(id: string, body: Partial<Pick<TicketDetail, 'status' | 'priority' | 'category'>>) {
  const { data } = await axios.patch<TicketDetail>(`/api/tickets/${id}`, body)
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
  AGENT: { bubble: 'bg-blue-600 text-white', label: 'Agent', align: 'items-end' },
  AI: { bubble: 'bg-purple-100 text-purple-800', label: 'AI', align: 'items-start' },
}

const categoryLabels: Record<TicketCategory, string> = {
  ACCOUNT: 'Account',
  INQUIRY: 'Inquiry',
  REFUND: 'Refunds',
  TECHNICAL: 'Technical',
  VOUCHER: 'Voucher',
  OTHER: 'Others',
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: ticket, isPending, error } = useQuery({
    queryKey: ['tickets', id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
  })

  const [status, setStatus] = useState<TicketStatus | ''>('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [category, setCategory] = useState<TicketCategory | ''>('')
  const [updateError, setUpdateError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (body: Partial<Pick<TicketDetail, 'status' | 'priority' | 'category'>>) =>
      patchTicket(id!, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['tickets', id], updated)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setStatus('')
      setPriority('')
      setCategory('')
      setUpdateError(null)
    },
    onError: (err: any) => {
      setUpdateError(err?.response?.data?.error ?? 'Update failed')
    },
  })

  const handleUpdate = () => {
    const body: Partial<Pick<TicketDetail, 'status' | 'priority' | 'category'>> = {}
    if (status) body.status = status
    if (priority) body.priority = priority
    if (category) body.category = category
    if (Object.keys(body).length === 0) return
    mutation.mutate(body)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate('/tickets')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tickets
        </button>

        {isPending && (
          <div className="space-y-4">
            <Skeleton className="h-7 w-96" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600">{error.message}</p>
        )}

        {ticket && (
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
                  <span>
                    Priority: <span className="font-medium text-gray-700">{ticket.priority}</span>
                  </span>
                )}
                {ticket.category && (
                  <span>
                    Category: <span className="font-medium text-gray-700">{categoryLabels[ticket.category]}</span>
                  </span>
                )}
                <span>
                  Assigned: <span className="font-medium text-gray-700">{ticket.assigned_to?.name ?? 'Unassigned'}</span>
                </span>
                <span>
                  Opened: <span className="font-medium text-gray-700">{new Date(ticket.created_at).toLocaleString()}</span>
                </span>
              </div>
            </div>

            {/* Update panel */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Update Ticket</h2>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label htmlFor="td-status" className="text-xs text-gray-500">Status</label>
                  <select
                    id="td-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TicketStatus | '')}
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— no change —</option>
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
                    onChange={(e) => setPriority(e.target.value as Priority | '')}
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— no change —</option>
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
                    onChange={(e) => setCategory(e.target.value as TicketCategory | '')}
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— no change —</option>
                    <option value="ACCOUNT">Account</option>
                    <option value="INQUIRY">Inquiry</option>
                    <option value="REFUND">Refunds</option>
                    <option value="TECHNICAL">Technical</option>
                    <option value="VOUCHER">Voucher</option>
                    <option value="OTHER">Others</option>
                  </select>
                </div>
                <Button
                  onClick={handleUpdate}
                  disabled={mutation.isPending || (!status && !priority && !category)}
                >
                  {mutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
              {updateError && <p className="mt-2 text-sm text-red-600">{updateError}</p>}
            </div>

            {/* Message thread */}
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">
                Messages ({ticket.messages.length})
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
          </div>
        )}
      </main>
    </div>
  )
}
