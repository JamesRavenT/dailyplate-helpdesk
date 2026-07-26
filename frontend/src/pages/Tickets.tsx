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
import { Brain, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, User } from 'lucide-react'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { StatusBadge, type TicketStatus } from '../components/ui/status-badge'
import { PriorityBadge, type TicketPriority } from '../components/ui/priority-badge'
import { CategoryBadge, type TicketCategory } from '../components/ui/category-badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { authClient } from '../lib/auth-client'

type Priority = TicketPriority
type Category = TicketCategory

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

const categoryLabels: Record<Category, string> = {
  ACCOUNT: 'Account',
  INQUIRY: 'Inquiry',
  PAYMENT:  'Payments',
  DELIVERY: 'Delivery',
  MENU:     'Menu',
  TECHNICAL: 'Technical',
  VOUCHER: 'Voucher',
  OTHER: 'Others',
}

const priorityRail: Record<Priority, string> = {
  LOW: 'border-l-muted-foreground/35',
  MEDIUM: 'border-l-status-inprogress',
  HIGH: 'border-l-status-danger',
}

const statusRail: Record<TicketStatus, string> = {
  OPEN: 'border-l-status-open',
  IN_PROGRESS: 'border-l-status-inprogress',
  RESOLVED: 'border-l-status-resolved',
  CLOSED: 'border-l-status-resolved',
  AI_PROCESSING: 'border-l-status-ai-resolved',
  AI_RESOLVED: 'border-l-status-ai-resolved',
}

function ticketRail(ticket: TicketListItem) {
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' || ticket.status === 'AI_RESOLVED') {
    return statusRail[ticket.status]
  }
  return ticket.priority ? priorityRail[ticket.priority] : statusRail[ticket.status]
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
  if (sorted === 'asc') return <ChevronUp aria-hidden="true" className="size-3.5" />
  if (sorted === 'desc') return <ChevronDown aria-hidden="true" className="size-3.5" />
  return <ChevronsUpDown aria-hidden="true" className="size-3.5 text-muted-foreground/55" />
}

const controlClass =
  'h-9 rounded-lg border border-input bg-card px-3 text-label text-foreground shadow-e1 outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 motion-reduce:transition-none'

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

  const { data: response, isPending, error, refetch } = useQuery({
    queryKey: ['tickets', sortBy, sortOrder, filterCategory, filterStatus, search, page],
    queryFn: () => fetchTickets(sortBy, sortOrder, filterCategory, filterStatus, search, page),
    refetchInterval: 15_000,
    staleTime: 0,
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
          <div className="flex min-w-52 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <StatusBadge status={row.original.status} />
              <span className="tabular text-[0.6875rem] text-muted-foreground">#{row.original.id.slice(0, 8)}</span>
            </div>
            <Link
              to={`/tickets/${row.original.id}`}
              className="w-fit max-w-72 truncate text-label font-semibold text-foreground outline-none transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
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
          <div className="min-w-36">
            <div className="text-label font-medium text-foreground">{row.original.customer_name}</div>
            <div className="mt-0.5 max-w-48 truncate text-caption text-muted-foreground">{row.original.customer_email}</div>
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => {
          const category = row.original.category
          return category ? (
            <CategoryBadge category={category} />
          ) : (
            <span className="text-muted-foreground/55">—</span>
          )
        },
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => {
          const { status, priority } = row.original
          if (status === 'RESOLVED' || status === 'CLOSED') {
            return <span className="text-muted-foreground/55">—</span>
          }
          return priority ? (
            <PriorityBadge priority={priority} />
          ) : (
            <span className="text-muted-foreground/55">—</span>
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
          return assigned_to ? (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setModal({ mode: 'view', ticketId: id, agent: assigned_to })}
              title={assigned_to.name}
              aria-label={assigned_to.name}
              className="mx-auto"
            >
              {is_ai_handled
                ? <Brain aria-hidden="true" className="text-status-ai-resolved" />
                : <User aria-hidden="true" className="text-muted-foreground" />
              }
            </Button>
          ) : (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setModal({ mode: 'assign', ticketId: id })}
              className="mx-auto"
            >
              Assign
            </Button>
          )
        },
      })
    }

    base.push({
      accessorKey: 'last_updated_at',
      header: 'Last Update',
      cell: ({ row }) => (
        <span className="tabular whitespace-nowrap text-caption text-muted-foreground">
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
    <div>
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-h1 font-semibold tracking-tight text-foreground">Tickets</h1>
              {!isPending && !error ? (
                <span className="tabular rounded-full bg-muted px-2.5 py-1 text-caption font-medium text-muted-foreground">
                  {total} {total === 1 ? 'ticket' : 'tickets'}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-body text-muted-foreground">
              {isAdmin ? 'Incoming support requests from email' : 'Support requests assigned to you'}
            </p>
          </div>

          <div role="search" aria-label="Filter tickets" className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-56 flex-1 sm:flex-none">
              <span className="sr-only">Search tickets</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search tickets…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-9 sm:w-60"
              />
            </label>

            <select
              aria-label="Filter by category"
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
              aria-label="Filter by status"
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

            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterCategory('')
                  setFilterStatus('')
                  setSearchInput('')
                  setSearch('')
                  setPage(1)
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        </header>

        {error ? (
          <ErrorState
            title="Ticket queue unavailable"
            description={error.message}
            action={<Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button>}
          />
        ) : null}

        {!error && (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-e1">
            <div className="overflow-x-auto">
              <table aria-label="Tickets" className="w-full min-w-[860px] border-collapse text-body">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                <tr className="border-b border-border">
                  {table.getHeaderGroups()[0].headers.map(header => (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none'}
                      className={`px-4 py-3 text-caption font-semibold text-muted-foreground ${header.column.id === 'assigned_to' ? 'text-center' : 'text-left'}`}
                    >
                      {isPending ? (
                        flexRender(header.column.columnDef.header, header.getContext())
                      ) : (
                        <button
                          type="button"
                          aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                          className="inline-flex items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
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
                    <tr key={i} className="border-b border-border/70 last:border-b-0">
                      <td className="border-l-4 border-l-transparent px-4 py-3.5"><Skeleton className="h-10 w-48" /></td>
                      <td className="px-4 py-3.5"><Skeleton className="h-8 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      {isAdmin && <td className="px-4 py-3 text-center"><Skeleton className="h-7 w-20 rounded-md mx-auto" /></td>}
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    </tr>
                  ))
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="p-4">
                      <EmptyState
                        className="min-h-52 border-0 bg-transparent"
                        title="No tickets match the current filters."
                        description="Adjust the search or filters to widen the queue."
                      />
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr
                      key={row.id}
                      className="group border-b border-border/70 transition-colors hover:bg-muted/45 last:border-b-0 motion-reduce:transition-none"
                    >
                      {row.getVisibleCells().map(cell => (
                        <td
                          key={cell.id}
                          className={`px-4 py-3.5 align-middle ${cell.column.id === 'subject' ? `border-l-4 ${ticketRail(row.original)}` : ''} ${cell.column.id === 'assigned_to' ? 'text-center' : ''}`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-muted/25 px-4 py-3 sm:flex-row">
              <p className="tabular text-caption text-muted-foreground">
                {isPending
                  ? 'Loading…'
                  : total === 0
                  ? 'No tickets'
                  : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
              </p>
              <nav aria-label="Ticket pagination" className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="First page"
                  onClick={() => setPage(1)}
                  disabled={page <= 1 || isPending}
                  title="First page"
                >
                  <ChevronsLeft aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous page"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page <= 1 || isPending}
                  title="Previous page"
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>

                <div className="mx-1 flex items-center gap-1">
                  {getPageNumbers(page, totalPages).map((p, i) =>
                    p === 'gap' ? (
                      <span key={`gap-${i}`} className="w-8 select-none text-center text-label text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? 'primary' : 'ghost'}
                        size="icon-sm"
                        aria-label={`Go to page ${p}`}
                        aria-current={p === page ? 'page' : undefined}
                        onClick={() => setPage(p)}
                        disabled={isPending}
                      >
                        {p}
                      </Button>
                    )
                  )}
                </div>

                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next page"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages || isPending}
                  title="Next page"
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Last page"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages || isPending}
                  title="Last page"
                >
                  <ChevronsRight aria-hidden="true" />
                </Button>
              </nav>
            </div>
          </div>
        )}
      </div>

      {/* Agent assignment modal */}
      {modal && (
        <Dialog open onOpenChange={(open) => { if (!open) setModal(null) }}>
          <DialogContent className="sm:max-w-md">
            {modal.mode === 'assign' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Assign Agent</DialogTitle>
                  <DialogDescription>Select an agent to take ownership of this ticket.</DialogDescription>
                </DialogHeader>
                {agents.length === 0 ? (
                  <EmptyState className="min-h-36" title="No agents available." icon={<User aria-hidden="true" className="size-5" />} />
                ) : (
                  <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                    {agents.map(a => (
                      <Button
                        key={a.id}
                        variant="ghost"
                        onClick={() => {
                          assignMutation.mutate({ ticketId: modal.ticketId, agentId: a.id })
                          setModal(null)
                        }}
                        className="h-auto w-full justify-start px-3 py-2.5 text-left"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-semibold text-foreground">
                          {a.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-label font-semibold text-foreground">{a.name}</span>
                          <span className="block truncate text-caption font-normal text-muted-foreground">{a.email}</span>
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Assigned Agent</DialogTitle>
                  <DialogDescription>Current ticket ownership and reassignment controls.</DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/45 p-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-label font-semibold text-foreground shadow-e1">
                    {modal.agent.name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-label font-semibold text-foreground">{modal.agent.name}</p>
                    <p className="truncate text-caption text-muted-foreground">{modal.agent.email}</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setModal({ mode: 'assign', ticketId: modal.ticketId })}
                  >
                    Re-assign
                  </Button>
                  <Button onClick={() => setModal(null)}>Close</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
