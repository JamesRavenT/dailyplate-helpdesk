import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Navbar from './Navbar'
import { authClient } from '../lib/auth-client'

vi.mock('axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))
vi.mock('../lib/auth-client', () => ({
  authClient: { useSession: vi.fn(), signOut: vi.fn() },
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: vi.fn() }
})

const mockNavigate = vi.fn()

function makeAgentSession(onlineStatus: string = 'ONLINE') {
  return {
    data: { user: { id: 'agent-1', name: 'Agent User', email: 'agent@test.com', role: 'AGENT', online_status: onlineStatus } },
    isPending: false,
    error: null,
  }
}

const adminSession = {
  data: { user: { id: 'admin-1', name: 'Admin User', email: 'admin@test.com', role: 'ADMIN', online_status: 'OFFLINE' } },
  isPending: false,
  error: null,
}

function renderNavbar(session = makeAgentSession()) {
  vi.mocked(authClient.useSession).mockReturnValue(session as any)
  vi.mocked(useNavigate).mockReturnValue(mockNavigate)
  vi.mocked(axios.patch).mockResolvedValue({})
  vi.mocked(authClient.signOut).mockResolvedValue(undefined as any)
  render(<MemoryRouter><Navbar /></MemoryRouter>)
}

describe('Navbar — navigation links', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the Helpdesk brand', () => {
    renderNavbar()
    expect(screen.getByText('Helpdesk')).toBeInTheDocument()
  })

  it('renders Dashboard and Tickets links for agents', () => {
    renderNavbar()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tickets' })).toBeInTheDocument()
  })

  it('admin sees the Users link', () => {
    renderNavbar(adminSession)
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument()
  })

  it('agent does not see the Users link', () => {
    renderNavbar(makeAgentSession('ONLINE'))
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
  })

  it('displays the logged-in user name', () => {
    renderNavbar()
    expect(screen.getByText('Agent User')).toBeInTheDocument()
  })
})

describe('Navbar — agent availability status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows Online label when session status is ONLINE', async () => {
    renderNavbar(makeAgentSession('ONLINE'))
    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument())
  })

  it('shows Away label when session status is AWAY', async () => {
    renderNavbar(makeAgentSession('AWAY'))
    await waitFor(() => expect(screen.getByText('Away')).toBeInTheDocument())
  })

  it('shows Meeting label when session status is MEETING', async () => {
    renderNavbar(makeAgentSession('MEETING'))
    await waitFor(() => expect(screen.getByText('Meeting')).toBeInTheDocument())
  })

  it('admin does not see the status dropdown button', () => {
    renderNavbar(adminSession)
    // Only the Sign Out button should be present — no status toggle
    expect(screen.queryByText('Online')).not.toBeInTheDocument()
    expect(screen.queryByText('Away')).not.toBeInTheDocument()
    expect(screen.queryByText('Meeting')).not.toBeInTheDocument()
  })

  it('clicking the status button opens the dropdown with selectable options', async () => {
    renderNavbar(makeAgentSession('ONLINE'))
    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Online'))

    // Dropdown should show Away and Meeting (Online is already visible as main button label)
    await waitFor(() => expect(screen.getByRole('button', { name: /away/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /meeting/i })).toBeInTheDocument()
  })

  it('dropdown does not contain an Offline option', async () => {
    renderNavbar(makeAgentSession('ONLINE'))
    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Online'))

    await waitFor(() => expect(screen.getByRole('button', { name: /away/i })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /offline/i })).not.toBeInTheDocument()
  })

  it('selecting Away calls PATCH /api/users/status with AWAY', async () => {
    renderNavbar(makeAgentSession('ONLINE'))
    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Online'))
    await waitFor(() => expect(screen.getByRole('button', { name: /away/i })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /away/i }))

    await waitFor(() =>
      expect(vi.mocked(axios.patch)).toHaveBeenCalledWith('/api/users/status', { status: 'AWAY' })
    )
  })

  it('selecting Meeting calls PATCH /api/users/status with MEETING', async () => {
    renderNavbar(makeAgentSession('ONLINE'))
    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Online'))
    await waitFor(() => expect(screen.getByRole('button', { name: /meeting/i })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /meeting/i }))

    await waitFor(() =>
      expect(vi.mocked(axios.patch)).toHaveBeenCalledWith('/api/users/status', { status: 'MEETING' })
    )
  })

  it('after selecting Away, status label updates to Away', async () => {
    renderNavbar(makeAgentSession('ONLINE'))
    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Online'))
    await waitFor(() => expect(screen.getByRole('button', { name: /away/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /away/i }))

    await waitFor(() => expect(screen.getByText('Away')).toBeInTheDocument())
    expect(screen.queryByText('Online')).not.toBeInTheDocument()
  })
})

describe('Navbar — queue trigger: auto-online on mount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('auto-sets ONLINE and calls PATCH when session status is OFFLINE', async () => {
    renderNavbar(makeAgentSession('OFFLINE'))

    await waitFor(() =>
      expect(vi.mocked(axios.patch)).toHaveBeenCalledWith('/api/users/status', { status: 'ONLINE' })
    )
  })

  it('displays Online label after auto-setting from OFFLINE', async () => {
    renderNavbar(makeAgentSession('OFFLINE'))

    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument())
  })

  it('does NOT call PATCH when session status is already ONLINE', async () => {
    renderNavbar(makeAgentSession('ONLINE'))
    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument())

    expect(vi.mocked(axios.patch)).not.toHaveBeenCalled()
  })

  it('does NOT call PATCH when session status is AWAY', async () => {
    renderNavbar(makeAgentSession('AWAY'))
    await waitFor(() => expect(screen.getByText('Away')).toBeInTheDocument())

    expect(vi.mocked(axios.patch)).not.toHaveBeenCalled()
  })

  it('admin does not trigger auto-ONLINE on mount', async () => {
    renderNavbar(adminSession)
    // Give effects a chance to fire
    await waitFor(() => expect(screen.getByText('Sign Out')).toBeInTheDocument())

    expect(vi.mocked(axios.patch)).not.toHaveBeenCalled()
  })
})

describe('Navbar — sign out', () => {
  beforeEach(() => vi.clearAllMocks())

  it('agent sign out calls PATCH OFFLINE before signOut', async () => {
    renderNavbar(makeAgentSession('ONLINE'))
    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() =>
      expect(vi.mocked(axios.patch)).toHaveBeenCalledWith('/api/users/status', { status: 'OFFLINE' })
    )
    await waitFor(() => expect(vi.mocked(authClient.signOut)).toHaveBeenCalled())
  })

  it('agent sign out navigates to /login after signing out', async () => {
    renderNavbar(makeAgentSession('ONLINE'))
    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
  })

  it('admin sign out does NOT patch OFFLINE status', async () => {
    renderNavbar(adminSession)
    await waitFor(() => expect(screen.getByText('Sign Out')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => expect(vi.mocked(authClient.signOut)).toHaveBeenCalled())

    const offlineCalls = vi.mocked(axios.patch).mock.calls.filter(
      (call) => (call[1] as { status?: string })?.status === 'OFFLINE'
    )
    expect(offlineCalls).toHaveLength(0)
  })

  it('admin sign out still navigates to /login', async () => {
    renderNavbar(adminSession)
    await waitFor(() => expect(screen.getByText('Sign Out')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
  })
})
