import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Users from './Users'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('../components/Navbar', () => ({ default: () => <nav /> }))

const mockedGet = vi.mocked(axios.get)

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

const mockUsers = [
  {
    id: '1',
    name: 'Alice Admin',
    email: 'alice@example.com',
    role: 'ADMIN' as const,
    is_active: true,
    createdAt: '2024-01-15T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Bob Agent',
    email: 'bob@example.com',
    role: 'AGENT' as const,
    is_active: false,
    createdAt: '2024-03-20T00:00:00.000Z',
  },
]

describe('Users page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows skeleton rows while loading', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<Users />)
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons).toHaveLength(40) // 5 rows × (5 data cells + 3 action buttons)
  })

  it('renders the page heading', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<Users />)
    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument()
  })

  it('renders user rows after data loads', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery(<Users />)
    expect(await screen.findByText('Alice Admin')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Bob Agent')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
  })

  it('renders ADMIN badge with blue styling', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery(<Users />)
    await screen.findByText('Alice Admin')
    expect(screen.getByText('ADMIN')).toHaveClass('bg-blue-100', 'text-blue-700')
  })

  it('renders AGENT badge with gray styling', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery(<Users />)
    await screen.findByText('Alice Admin')
    expect(screen.getByText('AGENT')).toHaveClass('bg-gray-100', 'text-gray-600')
  })

  it('renders Active status badge with green styling', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery(<Users />)
    await screen.findByText('Alice Admin')
    expect(screen.getByText('Active')).toHaveClass('bg-green-100', 'text-green-700')
  })

  it('renders Inactive status badge with red styling', async () => {
    mockedGet.mockResolvedValue({ data: mockUsers })
    renderWithQuery(<Users />)
    await screen.findByText('Alice Admin')
    expect(screen.getByText('Inactive')).toHaveClass('bg-red-100', 'text-red-600')
  })

  it('shows "No users found." when the list is empty', async () => {
    mockedGet.mockResolvedValue({ data: [] })
    renderWithQuery(<Users />)
    expect(await screen.findByText('No users found.')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    mockedGet.mockRejectedValue(new Error('Failed to load users'))
    renderWithQuery(<Users />)
    expect(await screen.findByText('Failed to load users')).toBeInTheDocument()
  })
})
