import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Users from './Users'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('../components/Navbar', () => ({ default: () => <nav /> }))

const mockedGet = vi.mocked(axios.get)

function renderWithQuery() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><Users /></QueryClientProvider>)
}

const mockUsers = [
  {
    id: '1',
    name: 'Alice Admin',
    email: 'alice@example.com',
    role: 'ADMIN' as const,
    is_active: true,
    online_status: 'OFFLINE' as const,
    createdAt: '2024-01-15T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Bob Agent',
    email: 'bob@example.com',
    role: 'AGENT' as const,
    is_active: false,
    online_status: 'ONLINE' as const,
    createdAt: '2024-03-20T00:00:00.000Z',
  },
  {
    id: '3',
    name: 'Carol Agent',
    email: 'carol@example.com',
    role: 'AGENT' as const,
    is_active: true,
    online_status: 'AWAY' as const,
    createdAt: '2024-04-01T00:00:00.000Z',
  },
]

describe('Users page', () => {
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
    // 5 rows × (6 data cells + 3 action button icons) = 45
    expect(skeletons).toHaveLength(45)
  })

  it('renders the page heading', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    renderWithQuery()
    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument()
  })

  it('renders Create User button', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    renderWithQuery()
    expect(screen.getByRole('button', { name: 'Create User' })).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  it('renders all column headers', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    renderWithQuery()
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Role' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Availability' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Member Since' })).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Data rows
  // ---------------------------------------------------------------------------

  it('renders user rows after data loads', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery()
    expect(await screen.findByText('Alice Admin')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Bob Agent')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('Carol Agent')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Role badges
  // ---------------------------------------------------------------------------

  it('renders ADMIN badge with blue styling', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery()
    await screen.findByText('Alice Admin')
    expect(screen.getByText('ADMIN')).toHaveClass('bg-blue-100', 'text-blue-700')
  })

  it('renders AGENT badge with gray styling', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery()
    await screen.findByText('Alice Admin')
    // Both agents → grab the first
    expect(screen.getAllByText('AGENT')[0]).toHaveClass('bg-gray-100', 'text-gray-600')
  })

  // ---------------------------------------------------------------------------
  // Status (account lock) column
  // ---------------------------------------------------------------------------

  it('renders Active status badge with green styling', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery()
    await screen.findByText('Alice Admin')
    // Alice Admin and Carol Agent are active — grab the first
    expect(screen.getAllByText('Active')[0]).toHaveClass('bg-green-100', 'text-green-700')
  })

  it('renders Locked status badge with red styling for inactive accounts', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery()
    await screen.findByText('Alice Admin')
    expect(screen.getByText('Locked')).toHaveClass('bg-red-100', 'text-red-600')
  })

  // ---------------------------------------------------------------------------
  // Availability column — agent online status
  // ---------------------------------------------------------------------------

  it('agent with ONLINE status shows green dot and Online label', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery()
    await screen.findByText('Bob Agent')
    expect(screen.getByText('Online')).toBeInTheDocument()
    const dot = screen.getByText('Online').previousElementSibling
    expect(dot).toHaveClass('bg-green-500')
  })

  it('agent with AWAY status shows yellow dot and Away label', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery()
    await screen.findByText('Carol Agent')
    expect(screen.getByText('Away')).toBeInTheDocument()
    const dot = screen.getByText('Away').previousElementSibling
    expect(dot).toHaveClass('bg-yellow-400')
  })

  it('admin row shows em-dash in Availability column', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery()
    await screen.findByText('Alice Admin')
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('admin row does not show an online status dot', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery()
    await screen.findByText('Alice Admin')
    // The '—' cell should not have a sibling dot span
    const dash = screen.getByText('—')
    expect(dash.previousElementSibling).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Empty and error states
  // ---------------------------------------------------------------------------

  it('shows "No users found." when the list is empty', async () => {
    mockedGet.mockResolvedValue({ data: [] })
    renderWithQuery()
    expect(await screen.findByText('No users found.')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    mockedGet.mockRejectedValue(new Error('Failed to load users'))
    renderWithQuery()
    expect(await screen.findByText('Failed to load users')).toBeInTheDocument()
  })
})
