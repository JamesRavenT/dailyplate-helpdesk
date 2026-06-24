import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { authClient } from '../lib/auth-client'
import Tickets from './Tickets'

vi.mock('axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))
vi.mock('../components/Navbar', () => ({ default: () => <nav /> }))
vi.mock('../lib/auth-client', () => ({ authClient: { useSession: vi.fn() } }))

const mockedGet = vi.mocked(axios.get)

const adminSession = { user: { id: 'admin-1', name: 'Admin', email: 'admin@test.com', role: 'ADMIN' } }
const agentSession = { user: { id: 'agent-1', name: 'Agent', email: 'agent@test.com', role: 'AGENT' } }
const mockAgents = [{ id: 'agent-1', name: 'Agent One', email: 'agent1@example.com' }]

const mockTicketsResponse = {
  data: [
    {
      id: 'ticket-1',
      subject: 'Cannot log in',
      customer_name: 'Alice Smith',
      customer_email: 'alice@example.com',
      status: 'OPEN' as const,
      priority: 'HIGH' as const,
      category: 'ACCOUNT' as const,
      created_at: '2024-01-15T10:00:00.000Z',
      assigned_to: null,
    },
    {
      id: 'ticket-2',
      subject: 'Refund request',
      customer_name: 'Bob Jones',
      customer_email: 'bob@example.com',
      status: 'IN_PROGRESS' as const,
      priority: 'LOW' as const,
      category: 'REFUND' as const,
      created_at: '2024-01-14T09:00:00.000Z',
      assigned_to: { id: 'agent-1', name: 'Agent One', email: 'agent1@example.com' },
    },
  ],
  total: 2,
  page: 1,
  pageSize: 10,
}

function renderWithQuery(session = adminSession) {
  vi.mocked(authClient.useSession).mockReturnValue({ data: session, isPending: false, error: null } as any)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Tickets />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Tickets page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  it('shows skeleton rows while loading', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    renderWithQuery()
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // Page structure
  // ---------------------------------------------------------------------------

  it('renders the page heading', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    renderWithQuery()
    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeInTheDocument()
  })

  it('renders the search input', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    renderWithQuery()
    expect(screen.getByPlaceholderText('Search tickets…')).toBeInTheDocument()
  })

  it('renders category and status filter dropdowns', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    renderWithQuery()
    expect(screen.getByDisplayValue('All Categories')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All Statuses')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Data loaded — ticket rows
  // ---------------------------------------------------------------------------

  it('renders ticket subjects and customer names after data loads', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicketsResponse })
    )
    renderWithQuery()
    expect(await screen.findByRole('link', { name: 'Cannot log in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Refund request' })).toBeInTheDocument()
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
  })

  it('shows Open status badge with blue styling', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicketsResponse })
    )
    renderWithQuery()
    await screen.findByRole('link', { name: 'Cannot log in' })
    // Use { selector: 'span' } to skip <option> elements that also contain "Open"
    const badge = screen.getAllByText('Open', { selector: 'span' })[0]
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-700')
  })

  it('shows In Progress status badge with amber styling', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicketsResponse })
    )
    renderWithQuery()
    await screen.findByRole('link', { name: 'Refund request' })
    const badge = screen.getAllByText('In Progress', { selector: 'span' })[0]
    expect(badge).toHaveClass('bg-amber-100', 'text-amber-700')
  })

  it('shows Account category badge', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicketsResponse })
    )
    renderWithQuery()
    await screen.findByRole('link', { name: 'Cannot log in' })
    // Category badge is a <span> — use selector to avoid matching the <option>
    const badge = screen.getAllByText('Account', { selector: 'span' })[0]
    expect(badge).toHaveClass('bg-gray-900', 'text-white')
  })

  it('shows priority badge for an active ticket', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicketsResponse })
    )
    renderWithQuery()
    await screen.findByRole('link', { name: 'Cannot log in' })
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('shows pagination count after data loads', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicketsResponse })
    )
    renderWithQuery()
    await screen.findByRole('link', { name: 'Cannot log in' })
    expect(screen.getByText(/showing 1.+of 2/i)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Empty and error states
  // ---------------------------------------------------------------------------

  it('shows empty state when no tickets match', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: { data: [], total: 0, page: 1, pageSize: 10 } })
    )
    renderWithQuery()
    expect(await screen.findByText('No tickets match the current filters.')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    mockedGet.mockRejectedValue(new Error('Network error'))
    renderWithQuery()
    expect(await screen.findByText('Network error')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Role-based column visibility
  // ---------------------------------------------------------------------------

  it('admin sees "Agent" column header', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicketsResponse })
    )
    renderWithQuery(adminSession)
    await screen.findByRole('link', { name: 'Cannot log in' })
    expect(screen.getByRole('columnheader', { name: /agent/i })).toBeInTheDocument()
  })

  it('agent does not see "Agent" column header', async () => {
    mockedGet.mockResolvedValue({ data: mockTicketsResponse })
    renderWithQuery(agentSession)
    await screen.findByRole('link', { name: 'Cannot log in' })
    expect(screen.queryByRole('columnheader', { name: /^agent$/i })).not.toBeInTheDocument()
  })

  it('admin sees "Assign" button for unassigned ticket', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicketsResponse })
    )
    renderWithQuery(adminSession)
    await screen.findByRole('link', { name: 'Cannot log in' })
    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument()
  })

  it('admin sees agent icon button (titled with agent name) for an assigned ticket', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicketsResponse })
    )
    renderWithQuery(adminSession)
    await screen.findByRole('link', { name: 'Refund request' })
    // The button title is set to the assigned agent's name
    expect(screen.getByRole('button', { name: 'Agent One' })).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Role-based status filter options
  // ---------------------------------------------------------------------------

  it('admin status filter shows all four statuses', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicketsResponse })
    )
    renderWithQuery(adminSession)
    await screen.findByRole('link', { name: 'Cannot log in' })
    const statusSelect = screen.getByDisplayValue('All Statuses')
    const opts = Array.from(statusSelect.querySelectorAll('option')).map(o => o.textContent)
    expect(opts).toContain('Open')
    expect(opts).toContain('In Progress')
    expect(opts).toContain('Resolved')
    expect(opts).toContain('Closed')
  })

  it('agent status filter only shows Open and In Progress', async () => {
    mockedGet.mockResolvedValue({ data: mockTicketsResponse })
    renderWithQuery(agentSession)
    await screen.findByRole('link', { name: 'Cannot log in' })
    const statusSelect = screen.getByDisplayValue('All Statuses')
    const opts = Array.from(statusSelect.querySelectorAll('option')).map(o => o.textContent)
    expect(opts).toContain('Open')
    expect(opts).toContain('In Progress')
    expect(opts).not.toContain('Resolved')
    expect(opts).not.toContain('Closed')
  })
})
