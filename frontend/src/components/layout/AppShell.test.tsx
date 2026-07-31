import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppShell from './AppShell'
import { authClient } from '../../lib/auth-client'
import { endSession } from '../../lib/session'

vi.mock('axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))
vi.mock('../../lib/auth-client', () => ({
  authClient: { useSession: vi.fn(), signOut: vi.fn() },
}))
vi.mock('../../hooks/useIdleLogout', () => ({
  useIdleLogout: () => ({ showWarning: false, remainingSeconds: 0, staySignedIn: vi.fn() }),
}))
vi.mock('../../lib/session', () => ({ endSession: vi.fn() }))

const mockedGet = vi.mocked(axios.get)
const mockedPatch = vi.mocked(axios.patch)

function makeAgentSession(onlineStatus: string = 'ONLINE') {
  return {
    data: {
      user: {
        id: 'agent-1',
        name: 'Agent User',
        email: 'agent@test.com',
        role: 'AGENT',
        online_status: onlineStatus,
      },
    },
    isPending: false,
    error: null,
  }
}

const adminSession = {
  data: {
    user: {
      id: 'admin-1',
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'ADMIN',
      online_status: 'OFFLINE',
    },
  },
  isPending: false,
  error: null,
}

function renderShell(
  session: ReturnType<typeof makeAgentSession> | typeof adminSession = makeAgentSession(),
  initialPath = '/',
) {
  vi.mocked(authClient.useSession).mockReturnValue(session as never)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppShell />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function openStatusMenu() {
  const trigger = await screen.findByRole('button', { name: /availability:/i })
  fireEvent.click(trigger)
}

async function openUserMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }))
  return screen.findByRole('menu', { name: 'User menu' })
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGet.mockResolvedValue({ data: { new: 0 } })
    mockedPatch.mockResolvedValue({})
    vi.mocked(authClient.signOut).mockResolvedValue(undefined as never)
    vi.mocked(endSession).mockResolvedValue(undefined)
  })

  describe('navigation and identity', () => {
    it('renders the DailyPlate Helpdesk brand and primary agent links', () => {
      renderShell()

      expect(screen.getByText('DailyPlate')).toBeInTheDocument()
      expect(screen.getByText('Helpdesk')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Tickets' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Resources' })).toBeInTheDocument()
    })

    it('marks the current route as active', () => {
      renderShell(makeAgentSession(), '/tickets')

      expect(screen.getByRole('link', { name: /^Tickets/ })).toHaveAttribute('aria-current', 'page')
    })

    it('shows Users only for admins', () => {
      const { unmount } = renderShell(makeAgentSession())
      expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()

      unmount()
      renderShell(adminSession)
      expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument()
    })

    it('displays the logged-in user name', () => {
      renderShell()
      expect(screen.getByText('Agent User')).toBeInTheDocument()
    })

    it('shows the live new-ticket count for agents', async () => {
      mockedGet.mockResolvedValue({ data: { new: 7 } })
      renderShell()

      expect(await screen.findByTestId('new-ticket-count')).toHaveTextContent('7')
      expect(mockedGet).toHaveBeenCalledWith('/api/tickets/stats')
    })

    it('opens and closes the mobile navigation drawer', () => {
      renderShell()

      const trigger = screen.getByRole('button', { name: 'Open navigation' })
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(trigger)
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('agent availability', () => {
    it.each([
      ['ONLINE', 'Online'],
      ['AWAY', 'Away'],
      ['MEETING', 'Meeting'],
    ])('shows %s session status as %s', async (sessionStatus, label) => {
      renderShell(makeAgentSession(sessionStatus))
      expect(await screen.findByRole('button', { name: `Availability: ${label}` })).toBeInTheDocument()
    })

    it('does not render an availability control for admins', () => {
      renderShell(adminSession)
      expect(screen.queryByRole('button', { name: /availability:/i })).not.toBeInTheDocument()
    })

    it('opens a selectable status menu without Offline', async () => {
      renderShell()
      await openStatusMenu()

      expect(screen.getByRole('menuitem', { name: 'Online' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Away' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Meeting' })).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Offline' })).not.toBeInTheDocument()
    })

    it.each([
      ['Away', 'AWAY'],
      ['Meeting', 'MEETING'],
    ])('selecting %s patches the matching status', async (label, status) => {
      renderShell()
      await openStatusMenu()
      fireEvent.click(screen.getByRole('menuitem', { name: label }))

      await waitFor(() =>
        expect(mockedPatch).toHaveBeenCalledWith('/api/users/status', { status }),
      )
      expect(screen.getByRole('button', { name: `Availability: ${label}` })).toBeInTheDocument()
    })

    it('auto-sets an offline agent to Online on mount', async () => {
      renderShell(makeAgentSession('OFFLINE'))

      await waitFor(() =>
        expect(mockedPatch).toHaveBeenCalledWith('/api/users/status', { status: 'ONLINE' }),
      )
      expect(screen.getByRole('button', { name: 'Availability: Online' })).toBeInTheDocument()
    })

    it('does not patch status on mount when an agent is already available', async () => {
      renderShell(makeAgentSession('AWAY'))
      expect(await screen.findByRole('button', { name: 'Availability: Away' })).toBeInTheDocument()
      expect(mockedPatch).not.toHaveBeenCalled()
    })

    it('does not auto-set admins online', () => {
      renderShell(adminSession)
      expect(mockedPatch).not.toHaveBeenCalled()
    })
  })

  describe('sign out', () => {
    it('sets an agent Offline before signing out and navigating', async () => {
      renderShell()
      await openUserMenu()
      fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Out' }))

      await waitFor(() => expect(endSession).toHaveBeenCalledWith('/login'))
      expect(mockedPatch).toHaveBeenCalledWith('/api/users/status', { status: 'OFFLINE' })
      expect(mockedPatch.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(endSession).mock.invocationCallOrder[0],
      )
    })

    it('signs out an admin without patching Offline', async () => {
      renderShell(adminSession)
      await openUserMenu()
      fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Out' }))

      await waitFor(() => expect(endSession).toHaveBeenCalledWith('/login'))
      expect(mockedPatch).not.toHaveBeenCalled()
    })
  })
})
