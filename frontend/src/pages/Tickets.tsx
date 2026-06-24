import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Brain, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, User } from 'lucide-react'
import Navbar from '../components/Navbar'
import { Skeleton } from '../components/ui/skeleton'
import { authClient } from '../lib/auth-client'

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'AI_PROCESSING' | 'AI_RESOLVED'
type Priority = 'LOW' | 'MEDIUM' | 'HIGH'
type Category = 'ACCOUNT' | 'INQUIRY' | 'REFUND' | 'TECHNICAL' | 'VOUCHER' | 'OTHER'

type TicketListItem = {
  id: string
  subject: string
  customer_name: string
  customer_email: string
  status: TicketStatus
  priority: Priority | null
  category: Category | null
  created_at: string
  last_updated_at: string | null
  assigned_to: Agent | null
  is_ai_handled: boolean
}

type TicketsResponse = {
  data: TicketListItem[]
  total: number
  page: number
  pageSize: number
}

type Agent = { id: string; name: string; email: string }

type ModalState =
  | { mode: 'assign'; ticketId: string }
  | { mode: 'view'; ticketId: string; agent: Agent }
  | null

const PAGE_SIZE = 10

const statusLabels: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  AI_PROCESSING: 'AI Processing',
  AI_RESOLVED: 'AI Resolved',
}

const statusBadgeClass: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
  AI_PROCESSING: 'bg-purple-100 text-purple-700',
  AI_RESOLVED: 'bg-emerald-100 text-emerald-700',
}

const statusDotClass: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  RESOLVED: 'bg-green-500',
  CLOSED: 'bg-gray-400',
  AI_PROCESSING: 'bg-purple-500',
  AI_RESOLVED: 'bg-emerald-500',
}

const categoryLabels: Record<Category, string> = {
  ACCOUNT: 'Account',
  INQUIRY: 'Inquiry',
  REFUND: 'Refunds',
  TECHNICAL: 'Technical',
  VOUCHER: 'Voucher',
  OTHER: 'Others',
}

const priorityStyles: Record<Priority, string> = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-violet-100 text-violet-700',
  HIGH: 'bg-red-100 text-red-600',
}

async function fetchTickets(
  sortBy: string,
  sortOrder: string,
  category: Category | '',
  status: TicketStatus | '',
  search: string,
  page: number,
): Promise<TicketsResponse> {
  const { data } = await axios.get<TicketsResponse>('/api/tickets', {
    params: {
      sortBy,
      sortOrder,
      page,
      pageSize: PAGE_SIZE,
      ...(category && { category }),
      ...(status && { status }),
      ...(search && { search }),
    },
  })
  return data
}

async function fetchAgents(): Promise<Agent[]> {
  const { data } = await axios.get<Agent[]>('/api/users/agents')
  return data
}

function getPageNumbers(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'gap')[] = [1]
  if (current > 3) pages.push('gap')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('gap')
  pages.push(total)
  return pages
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="ml-1 h-3 w-3" />
  if (sorted === 'desc') return <ChevronDown className="ml-1 h-3 w-3" />
  return <ChevronsUpDown className="ml-1 h-3 w-3 text-gray-400" />
}

const controlClass =
  'text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500'

const pageButtonClass =
  'text-sm px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

export default function Tickets() {
  const { data: session } = authClient.useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN'

  const queryClient = useQueryClient()
  const [modal, setModal] = useState<ModalState>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'last_updated_at', desc: true }])
  const [filterCategory, setFilterCategory] = useState<Category | ''>('')
  const [filterStatus, setFilterStatus] = useState<TicketStatus | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [sorting, filterCategory, filterStatus])

  const sortBy = sorting[0]?.id ?? 'created_at'
  const sortOrder = (sorting[0]?.desc ?? true) ? 'desc' : 'asc'

  const { data: response, isPending, error } = useQuery({
    queryKey: ['tickets', sortBy, sortOrder, filterCategory, filterStatus, search, page],
    queryFn: () => fetchTickets(sortBy, sortOrder, filterCategory, filterStatus, search, page),
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    enabled: isAdmin,
  })

  const assignMutation = useMutation({
    mutationFn: ({ ticketId, agentId }: { ticketId: string; agentId: string | null }) =>
      axios.patch<{ id: string; assigned_to: Agent | null }>(`/api/tickets/${ticketId}`, { assigned_to_id: agentId }),
    onSuccess: (res) => {
      const { id, assigned_to } = res.data
      queryClient.setQueriesData<TicketsResponse>(
        { queryKey: ['tickets'] },
        (old) => {
          if (!old || !Array.isArray((old as any).data)) return old
          return { ...old, data: old.data.map(t => t.id === id ? { ...t, assigned_to } : t) }
        },
      )
    },
  })

  const tickets = response?.data ?? []
  const total = response?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns = useMemo((): ColumnDef<TicketListItem>[] => {
    const base: ColumnDef<TicketListItem>[] = [
      {
        accessorKey: 'subject',
        header: 'Subject',
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium w-fit ${statusBadgeClass[row.original.status]}`}>
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusDotClass[row.original.status]}`} />
              {statusLabels[row.original.status]}
            </span>
            <Link
              to={`/tickets/${row.original.id}`}
              className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
            >
              {row.original.subject}
            </Link>
          </div>
        ),
      },
      {
        accessorKey: 'customer_name',
        header: 'Customer',
        cell: ({ row }) => (
          <div>
            <div className="text-gray-900">{row.original.customer_name}</div>
            <div className="text-gray-400 text-xs">{row.original.customer_email}</div>
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => {
          const category = row.original.category
          return category ? (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-900 text-white">
              {categoryLabels[category]}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )
        },
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => {
          const { status, priority } = row.original
          if (status === 'RESOLVED' || status === 'CLOSED') {
            return <span className="text-gray-400">--</span>
          }
          return priority ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[priority]}`}>
              {priority.charAt(0) + priority.slice(1).toLowerCase()}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )
        },
      },
    ]

    if (isAdmin) {
      base.push({
        id: 'assigned_to',
        accessorFn: row => row.assigned_to?.id ?? null,
        header: 'Agent',
        cell: ({ row }) => {
          const { id, assigned_to, is_ai_handled } = row.original
          const btnClass = "mx-auto flex items-center justify-center w-20 text-xs font-medium border border-gray-300 rounded-md px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
          return assigned_to ? (
            <button
              onClick={() => setModal({ mode: 'view', ticketId: id, agent: assigned_to })}
              title={assigned_to.name}
              className={btnClass}
            >
              {is_ai_handled
                ? <Brain className="h-4 w-4 text-purple-500" />
                : <User className="h-4 w-4 text-gray-500" />
              }
            </button>
          ) : (
            <button
              onClick={() => setModal({ mode: 'assign', ticketId: id })}
              className={`${btnClass} text-gray-900`}
            >
              Assign
            </button>
          )
        },
      })
    }

    base.push({
      accessorKey: 'last_updated_at',
      header: 'Last Update',
      cell: ({ row }) => (
        <span className="text-gray-500">
          {new Date(row.original.last_updated_at ?? row.original.created_at).toLocaleDateString()}
        </span>
      ),
    })

    return base
  }, [isAdmin, agents]) // assignMutation.mutate is stable in TanStack Query v5

  const table = useReactTable({
    data: tickets,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
  })

  const hasFilters = filterCategory || filterStatus || searchInput
  const colCount = columns.length

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Incoming support requests from email</p>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search tickets…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className={`${controlClass} w-52 cursor-text`}
          />

          <select
            value={filterCategory}
            onChange={e => { setFilterCategory(e.target.value as Category | ''); setPage(1) }}
            className={`${controlClass} cursor-pointer`}
          >
            <option value="">All Categories</option>
            {(Object.keys(categoryLabels) as Category[]).map(key => (
              <option key={key} value={key}>{categoryLabels[key]}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value as TicketStatus | ''); setPage(1) }}
            className={`${controlClass} cursor-pointer`}
          >
            <option value="">All Statuses</option>
            {(Object.keys(statusLabels) as TicketStatus[])
              .filter(key => isAdmin || key === 'OPEN' || key === 'IN_PROGRESS')
              .map(key => (
                <option key={key} value={key}>{statusLabels[key]}</option>
              ))}
          </select>

          {hasFilters && (
            <button
              onClick={() => {
                setFilterCategory('')
                setFilterStatus('')
                setSearchInput('')
                setSearch('')
                setPage(1)
              }}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error.message}</p>}

        {!error && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {table.getHeaderGroups()[0].headers.map(header => (
                    <th key={header.id} className={`px-4 py-3 font-medium text-gray-600 ${header.column.id === 'assigned_to' ? 'text-center' : 'text-left'}`}>
                      {isPending ? (
                        flexRender(header.column.columnDef.header, header.getContext())
                      ) : (
                        <button
                          className="inline-flex items-center hover:text-gray-900 transition-colors cursor-pointer"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon sorted={header.column.getIsSorted()} />
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isPending ? (
                  Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <tr key={i} className={i < PAGE_SIZE - 1 ? 'border-b border-gray-100' : ''}>
                      <td className="px-4 py-3"><Skeleton className="h-9 w-48" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      {isAdmin && <td className="px-4 py-3 text-center"><Skeleton className="h-7 w-20 rounded-md mx-auto" /></td>}
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    </tr>
                  ))
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="px-4 py-8 text-center text-gray-400">
                      No tickets match the current filters.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row, i) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-gray-50 transition-colors${i < table.getRowModel().rows.length - 1 ? ' border-b border-gray-100' : ''}`}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className={`px-4 py-3 ${cell.column.id === 'assigned_to' ? 'text-center' : ''}`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                {isPending
                  ? 'Loading…'
                  : total === 0
                  ? 'No tickets'
                  : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1 || isPending}
                  className={pageButtonClass}
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page <= 1 || isPending}
                  className={pageButtonClass}
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-1 mx-1">
                  {getPageNumbers(page, totalPages).map((p, i) =>
                    p === 'gap' ? (
                      <span key={`gap-${i}`} className="w-8 text-center text-sm text-gray-400 select-none">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        disabled={isPending}
                        className={`h-8 w-8 text-sm rounded-md transition-colors ${
                          p === page
                            ? 'bg-gray-900 text-white'
                            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>

                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages || isPending}
                  className={pageButtonClass}
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages || isPending}
                  className={pageButtonClass}
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Agent assignment modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-80 p-6"
            onClick={e => e.stopPropagation()}
          >
            {modal.mode === 'assign' ? (
              <>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Assign Agent</h2>
                {agents.length === 0 ? (
                  <p className="text-sm text-gray-400">No agents available.</p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {agents.map(a => (
                      <button
                        key={a.id}
                        onClick={() => {
                          assignMutation.mutate({ ticketId: modal.ticketId, agentId: a.id })
                          setModal(null)
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <p className="text-sm text-gray-800">{a.name}</p>
                        <p className="text-xs text-gray-400">{a.email}</p>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setModal(null)}
                  className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Assigned Agent</h2>
                <div className="flex items-center gap-3 py-2 mb-4">
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-xl select-none">
                    👤
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{modal.agent.name}</p>
                    <p className="text-xs text-gray-400">{modal.agent.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModal({ mode: 'assign', ticketId: modal.ticketId })}
                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
                  >
                    Re-assign
                  </button>
                  <button
                    onClick={() => setModal(null)}
                    className="flex-1 text-sm px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
