import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Home from './Home'
import { authClient } from '../lib/auth-client'
import { getRecentViewIds } from '../lib/recentViews'

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

vi.mock('../lib/auth-client', () => ({
  authClient: { useSession: vi.fn() },
}))

vi.mock('../components/Navbar', () => ({
  default: () => <nav data-testid="navbar" />,
}))

vi.mock('../lib/recentViews', () => ({
  getRecentViewIds: vi.fn(),
  trackRecentView: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: vi.fn() }
})

// Recharts uses ResizeObserver in the browser; stub it for happy-dom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// ─── sessions ────────────────────────────────────────────────────────────────

const adminSession = {
  data: {
    user: { id: 'admin-1', name: 'Admin User', email: 'admin@test.com', role: 'ADMIN', is_active: true },
  },
  isPending: false,
  error: null,
}

const agentSession = {
  data: {
    user: { id: 'agent-1', name: 'Agent User', email: 'agent@test.com', role: 'AGENT', is_active: true },
  },
  isPending: false,
  error: null,
}

// ─── fixtures ────────────────────────────────────────────────────────────────

const adminOpenTickets = [
  {
    id: 'admin-ticket-1',
    subject: 'Server is down',
    customer_name: 'Dave Admin',
    status: 'OPEN',
    priority: 'HIGH',
    created_at: '2026-06-10T00:00:00Z',
    last_updated_at: null,
  },
  {
    id: 'admin-ticket-2',
    subject: 'Cannot access billing',
    customer_name: 'Eve Admin',
    status: 'OPEN',
    priority: 'MEDIUM',
    created_at: '2026-06-11T00:00:00Z',
    last_updated_at: null,
  },
]

const onlineAgents = [
  { id: 'ag-1', name: 'Frank Agent', email: 'frank@test.com', online_status: 'ONLINE' },
  { id: 'ag-2', name: 'Grace Agent', email: 'grace@test.com', online_status: 'AWAY' },
]

const adminStats = {
  total: 42,
  ongoing: 8,
  resolvedByAI: 15,
  resolvedByAgents: 19,
  critical: 3,
  openTickets: adminOpenTickets,
  onlineAgents,
}

const agentStats = {
  total: 10,
  new: 2,
  ongoing: 3,
  resolvedClosed: 7,
  openTickets: [
    {
      id: 'ticket-1',
      subject: 'Cannot login to portal',
      customer_name: 'Alice Johnson',
      status: 'OPEN',
      priority: 'HIGH',
      created_at: '2026-06-01T00:00:00Z',
      last_updated_at: null,
    },
    {
      id: 'ticket-2',
      subject: 'Invoice missing from account',
      customer_name: 'Bob Smith',
      status: 'OPEN',
      priority: 'MEDIUM',
      created_at: '2026-06-02T00:00:00Z',
      last_updated_at: null,
    },
  ],
}

const emptyChart = {
  days: Array.from({ length: 30 }, (_, i) => {
    const d = new Date('2026-05-26')
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  }),
  received: Array(30).fill(0),
  resolved: Array(30).fill(0),
  resolvedByAI: Array(30).fill(0),
  resolvedByAgents: Array(30).fill(0),
}

const recentTickets = [
  {
    id: 'ticket-3',
    subject: 'Password reset not working',
    customer_name: 'Carol White',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    created_at: '2026-06-03T00:00:00Z',
    last_updated_at: null,
  },
]

// ─── render helper ───────────────────────────────────────────────────────────

function renderHome(session = adminSession) {
  vi.mocked(authClient.useSession).mockReturnValue(session as any)
  const mockNavigate = vi.fn()
  vi.mocked(useNavigate).mockReturnValue(mockNavigate)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { mockNavigate }
}

function mockAdminAxios() {
  vi.mocked(axios.get).mockImplementation(async (url: string) => {
    if (url === '/api/tickets/chart') return { data: emptyChart }
    return { data: adminStats }
  })
}

function mockAgentAxios(overrides = {}) {
  const stats = { ...agentStats, ...overrides }
  vi.mocked(axios.get).mockImplementation(async (url: string) => {
    if (url === '/api/tickets/chart') return { data: { ...emptyChart, resolvedByAI: undefined, resolvedByAgents: undefined } }
    return { data: stats }
  })
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

describe('Home — Admin Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRecentViewIds).mockReturnValue([])
  })

  it('shows welcome heading with admin name and email', () => {
    mockAdminAxios()
    renderHome(adminSession)
    expect(screen.getByText('Welcome back, Admin User')).toBeInTheDocument()
    expect(screen.getByText('admin@test.com')).toBeInTheDocument()
  })

  it('renders all five stat card labels after data loads', async () => {
    mockAdminAxios()
    renderHome(adminSession)
    await waitFor(() => expect(screen.getByText('Total Tickets')).toBeInTheDocument())
    expect(screen.getByText('Ongoing Tickets')).toBeInTheDocument()
    expect(screen.getByText('Resolved by AI')).toBeInTheDocument()
    expect(screen.getByText('Resolved by Agents')).toBeInTheDocument()
    expect(screen.getByText('Critical Tickets')).toBeInTheDocument()
  })

  it('displays the fetched stat values', async () => {
    mockAdminAxios()
    renderHome(adminSession)
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument())
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('19')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('does not render View Tickets or Manage Users buttons', () => {
    mockAdminAxios()
    renderHome(adminSession)
    expect(screen.queryByRole('button', { name: /view tickets/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /manage users/i })).not.toBeInTheDocument()
  })

  it('renders New Tickets section heading', () => {
    mockAdminAxios()
    renderHome(adminSession)
    expect(screen.getByRole('heading', { name: 'New Tickets', level: 2 })).toBeInTheDocument()
  })

  it('shows open tickets in the New Tickets slideshow', async () => {
    mockAdminAxios()
    renderHome(adminSession)
    await waitFor(() =>
      expect(screen.getByText('Server is down')).toBeInTheDocument()
    )
    expect(screen.getByText('Dave Admin')).toBeInTheDocument()
  })

  it('renders Online Agents section heading', () => {
    mockAdminAxios()
    renderHome(adminSession)
    expect(screen.getByRole('heading', { name: 'Online Agents', level: 2 })).toBeInTheDocument()
  })

  it('shows online agents with correct status labels', async () => {
    mockAdminAxios()
    renderHome(adminSession)
    await waitFor(() =>
      expect(screen.getByText('Frank Agent')).toBeInTheDocument()
    )
    expect(screen.getByText('Grace Agent')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Away')).toBeInTheDocument()
  })

  it('shows empty state when no agents are online', async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url === '/api/tickets/chart') return { data: emptyChart }
      return { data: { ...adminStats, onlineAgents: [] } }
    })
    renderHome(adminSession)
    await waitFor(() =>
      expect(screen.getByText('No agents are currently online.')).toBeInTheDocument()
    )
  })

  it('shows skeleton placeholders while stats are loading', () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))
    renderHome(adminSession)
    expect(screen.queryByText('Total Tickets')).not.toBeInTheDocument()
    expect(screen.queryByText('Ongoing Tickets')).not.toBeInTheDocument()
  })
})

// ─── Agent Dashboard ─────────────────────────────────────────────────────────

describe('Home — Agent Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRecentViewIds).mockReturnValue([])
  })

  it('shows welcome heading with agent name and email', () => {
    mockAgentAxios()
    renderHome(agentSession)
    expect(screen.getByText('Welcome back, Agent User')).toBeInTheDocument()
    expect(screen.getByText('agent@test.com')).toBeInTheDocument()
  })

  it('renders four stat card labels after data loads', async () => {
    mockAgentAxios()
    renderHome(agentSession)
    await waitFor(() => expect(screen.getByText('Total Tickets')).toBeInTheDocument())
    expect(screen.getByText('Ongoing Tickets')).toBeInTheDocument()
    expect(screen.getByText('Resolved / Closed')).toBeInTheDocument()
    // "New Tickets" appears as both a stat card and a section heading
    expect(screen.getAllByText('New Tickets').length).toBeGreaterThanOrEqual(1)
  })

  it('displays the fetched stat values', async () => {
    mockAgentAxios()
    renderHome(agentSession)
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument())
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders New Tickets and Recent Tickets section headings', () => {
    mockAgentAxios()
    renderHome(agentSession)
    expect(screen.getAllByText('New Tickets').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Recent Tickets')).toBeInTheDocument()
  })

  it('shows the first open ticket in the New Tickets slideshow', async () => {
    mockAgentAxios()
    renderHome(agentSession)
    await waitFor(() =>
      expect(screen.getByText('Cannot login to portal')).toBeInTheDocument()
    )
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
  })

  it('shows the correct status badge on the ticket card', async () => {
    mockAgentAxios()
    renderHome(agentSession)
    await waitFor(() =>
      expect(screen.getAllByText('Open', { selector: 'span' }).length).toBeGreaterThanOrEqual(1)
    )
  })

  it('shows the priority label on the ticket card', async () => {
    mockAgentAxios()
    renderHome(agentSession)
    await waitFor(() =>
      expect(screen.getByText('HIGH priority')).toBeInTheDocument()
    )
  })

  it('shows both open tickets side-by-side when there are exactly 2', async () => {
    mockAgentAxios()
    renderHome(agentSession)
    await waitFor(() =>
      expect(screen.getByText('Cannot login to portal')).toBeInTheDocument()
    )
    expect(screen.getByText('Invoice missing from account')).toBeInTheDocument()
  })

  it('shows navigation controls when tickets span more than one page', async () => {
    const threeTickets = [
      ...agentStats.openTickets,
      { id: 'ticket-extra', subject: 'Third ticket subject', customer_name: 'Extra User', status: 'OPEN', priority: 'LOW', created_at: '2026-06-04T00:00:00Z', last_updated_at: null },
    ]
    mockAgentAxios({ openTickets: threeTickets })
    renderHome(agentSession)
    await waitFor(() =>
      expect(screen.getByText('Cannot login to portal')).toBeInTheDocument()
    )
    // 3 tickets → 2 pages → prev + 2 dots + next = 4 nav buttons
    const heading = screen.getByRole('heading', { name: 'New Tickets', level: 2 })
    const section = heading.parentElement!
    const buttons = section.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(4)
  })

  it('shows empty state when no open tickets are assigned', async () => {
    mockAgentAxios({ openTickets: [] })
    renderHome(agentSession)
    await waitFor(() =>
      expect(screen.getByText('No open tickets assigned to you.')).toBeInTheDocument()
    )
  })

  it('shows empty state for Recent Tickets when agent has not viewed anything', async () => {
    mockAgentAxios()
    vi.mocked(getRecentViewIds).mockReturnValue([])
    renderHome(agentSession)
    await waitFor(() =>
      expect(screen.getByText('No recently viewed tickets.')).toBeInTheDocument()
    )
  })

  it('fetches and displays a recently viewed ticket', async () => {
    vi.mocked(getRecentViewIds).mockReturnValue(['ticket-3'])
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url === '/api/tickets/stats') return { data: agentStats }
      if (url.includes('by-ids')) return { data: recentTickets }
      return { data: emptyChart }
    })
    renderHome(agentSession)
    await waitFor(() =>
      expect(screen.getByText('Password reset not working')).toBeInTheDocument()
    )
    expect(screen.getByText('Carol White')).toBeInTheDocument()
  })

  it('clicking a New Tickets card navigates to that ticket', async () => {
    mockAgentAxios()
    const { mockNavigate } = renderHome(agentSession)
    await waitFor(() =>
      expect(screen.getByText('Cannot login to portal')).toBeInTheDocument()
    )
    fireEvent.click(screen.getByText('Cannot login to portal'))
    expect(mockNavigate).toHaveBeenCalledWith('/tickets/ticket-1')
  })

  it('clicking a Recent Tickets card navigates to that ticket', async () => {
    vi.mocked(getRecentViewIds).mockReturnValue(['ticket-3'])
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url === '/api/tickets/stats') return { data: agentStats }
      if (url.includes('by-ids')) return { data: recentTickets }
      return { data: emptyChart }
    })
    const { mockNavigate } = renderHome(agentSession)
    await waitFor(() =>
      expect(screen.getByText('Password reset not working')).toBeInTheDocument()
    )
    fireEvent.click(screen.getByText('Password reset not working'))
    expect(mockNavigate).toHaveBeenCalledWith('/tickets/ticket-3')
  })

  it('shows skeleton placeholders while stats are loading', () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))
    renderHome(agentSession)
    expect(screen.queryByText('Total Tickets')).not.toBeInTheDocument()
    expect(screen.getByText('Recent Tickets')).toBeInTheDocument()
  })
})
