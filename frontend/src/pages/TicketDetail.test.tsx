import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { authClient } from '../lib/auth-client'
import TicketDetail from './TicketDetail'

vi.mock('axios', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))
vi.mock('../components/Navbar', () => ({ default: () => <nav /> }))
vi.mock('../lib/auth-client', () => ({ authClient: { useSession: vi.fn() } }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...mod,
    useParams: () => ({ id: 'ticket-123' }),
    useNavigate: () => mockNavigate,
  }
})

const mockedGet = vi.mocked(axios.get)

const adminSession = { user: { id: 'admin-1', name: 'Admin', email: 'admin@test.com', role: 'ADMIN' } }
const agentSession = { user: { id: 'agent-1', name: 'Agent', email: 'agent@test.com', role: 'AGENT' } }
const mockAgents = [{ id: 'agent-1', name: 'Agent One', email: 'agent1@example.com' }]

const mockTicket = {
  id: 'ticket-123',
  subject: 'Cannot log in',
  customer_name: 'Alice Smith',
  customer_email: 'alice@example.com',
  status: 'OPEN' as const,
  priority: 'HIGH' as const,
  category: 'ACCOUNT' as const,
  created_at: '2024-01-15T10:00:00.000Z',
  assigned_to: null,
  messages: [
    {
      id: 'msg-1',
      body: 'Hello, I cannot log in.',
      sender_type: 'CUSTOMER' as const,
      sent_at: '2024-01-15T10:01:00.000Z',
    },
    {
      id: 'msg-2',
      body: 'We are looking into it.',
      sender_type: 'AGENT' as const,
      sent_at: '2024-01-15T10:15:00.000Z',
    },
  ],
}

function renderWithQuery(session = adminSession) {
  vi.mocked(authClient.useSession).mockReturnValue({ data: session, isPending: false, error: null } as any)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TicketDetail />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('TicketDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  it('shows skeletons while loading', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    renderWithQuery()
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // Ticket data rendered
  // ---------------------------------------------------------------------------

  it('renders ticket subject as h1', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    expect(await screen.findByRole('heading', { name: 'Cannot log in' })).toBeInTheDocument()
  })

  it('renders customer name and email', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('renders messages in the thread section', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.getByText('Hello, I cannot log in.')).toBeInTheDocument()
    expect(screen.getByText('We are looking into it.')).toBeInTheDocument()
  })

  it('thread heading shows the message count', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.getByText('Thread (2)')).toBeInTheDocument()
  })

  it('shows status badge in the header with correct label', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })
    // The header badge (not the dropdown) should show "Open"
    const openBadge = screen.getAllByText('Open')[0]
    expect(openBadge).toBeInTheDocument()
  })

  it('shows error message when ticket fetch fails', async () => {
    mockedGet.mockRejectedValue(new Error('Ticket not found'))
    renderWithQuery()
    expect(await screen.findByText('Ticket not found')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Update panel — dropdowns seeded from ticket
  // ---------------------------------------------------------------------------

  it('Status dropdown is seeded to the current ticket status', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.getByLabelText('Status')).toHaveValue('OPEN')
  })

  it('Priority dropdown is seeded to the current ticket priority', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.getByLabelText('Priority')).toHaveValue('HIGH')
  })

  it('Category dropdown is seeded to the current ticket category', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.getByLabelText('Category')).toHaveValue('ACCOUNT')
  })

  it('Save Changes is disabled when dropdowns match the current ticket', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  })

  it('Save Changes becomes enabled after changing the status', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'IN_PROGRESS' } })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
  })

  it('Save Changes becomes enabled after changing the priority', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })

    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'LOW' } })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
  })

  it('Save Changes becomes enabled after changing the category', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'REFUND' } })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
  })

  it('Save Changes returns to disabled if the dropdown is reverted', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'IN_PROGRESS' } })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'OPEN' } })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  })

  // ---------------------------------------------------------------------------
  // Role-based visibility — admin
  // ---------------------------------------------------------------------------

  it('admin sees the Agent field button in the update panel', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicket })
    )
    renderWithQuery(adminSession)
    await screen.findByRole('heading', { name: 'Cannot log in' })
    // Unassigned ticket → button text is "Unassigned"
    expect(screen.getByRole('button', { name: 'Unassigned' })).toBeInTheDocument()
  })

  it('admin does not see the reply box', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicket })
    )
    renderWithQuery(adminSession)
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.queryByPlaceholderText('Write your reply…')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send Reply' })).not.toBeInTheDocument()
  })

  it('clicking Agent button opens the assignment modal', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/api/users/agents'
        ? Promise.resolve({ data: mockAgents })
        : Promise.resolve({ data: mockTicket })
    )
    renderWithQuery(adminSession)
    await screen.findByRole('heading', { name: 'Cannot log in' })
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
    expect(screen.getByRole('heading', { name: 'Assign Agent' })).toBeInTheDocument()
    expect(screen.getByText('agent1@example.com')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Role-based visibility — agent
  // ---------------------------------------------------------------------------

  it('agent sees the reply textarea and Send Reply button', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery(agentSession)
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.getByPlaceholderText('Write your reply…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send Reply' })).toBeInTheDocument()
  })

  it('Send Reply button is disabled when the reply textarea is empty', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery(agentSession)
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.getByRole('button', { name: 'Send Reply' })).toBeDisabled()
  })

  it('Send Reply button becomes enabled when text is entered', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery(agentSession)
    await screen.findByRole('heading', { name: 'Cannot log in' })

    fireEvent.change(screen.getByPlaceholderText('Write your reply…'), {
      target: { value: 'Here is my reply.' },
    })
    expect(screen.getByRole('button', { name: 'Send Reply' })).toBeEnabled()
  })

  it('agent does not see the Agent field button', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery(agentSession)
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.queryByRole('button', { name: 'Unassigned' })).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  it('"Back to Tickets" button calls navigate("/tickets")', async () => {
    mockedGet.mockResolvedValue({ data: mockTicket })
    renderWithQuery()
    await screen.findByRole('heading', { name: 'Cannot log in' })
    fireEvent.click(screen.getByRole('button', { name: /back to tickets/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/tickets')
  })
})
