import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { authClient } from '../lib/auth-client'

type AgentStatus = 'ONLINE' | 'AWAY' | 'MEETING' | 'OFFLINE'

const STATUS_CONFIG: Record<AgentStatus, { label: string; dot: string }> = {
  ONLINE:  { label: 'Online',  dot: 'bg-green-500' },
  AWAY:    { label: 'Away',    dot: 'bg-yellow-400' },
  MEETING: { label: 'Meeting', dot: 'bg-red-500' },
  OFFLINE: { label: 'Offline', dot: 'bg-gray-400' },
}

const SELECTABLE: AgentStatus[] = ['ONLINE', 'AWAY', 'MEETING']

export default function Navbar() {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()
  const isAdmin = (session?.user as any)?.role === 'ADMIN'
  const sessionStatus = (session?.user as any)?.online_status as AgentStatus | undefined

  const [status, setStatus] = useState<AgentStatus>('OFFLINE')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Sync from session; auto-set ONLINE when logged in as agent
  useEffect(() => {
    if (!session || isAdmin) return
    const current = sessionStatus ?? 'OFFLINE'
    if (current === 'OFFLINE') {
      setStatus('ONLINE')
      axios.patch('/api/users/status', { status: 'ONLINE' }).catch(() => {})
    } else {
      setStatus(current)
    }
  }, [session?.user?.id])

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleStatusChange = async (next: AgentStatus) => {
    setStatus(next)
    setMenuOpen(false)
    await axios.patch('/api/users/status', { status: next }).catch(() => {})
  }

  const handleSignOut = async () => {
    if (!isAdmin) {
      await axios.patch('/api/users/status', { status: 'OFFLINE' }).catch(() => {})
    }
    await authClient.signOut()
    navigate('/login')
  }

  const cfg = STATUS_CONFIG[status]

  return (
    <nav className="border-b bg-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-gray-800">Helpdesk</span>
        <Link
          to="/"
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Dashboard
        </Link>
        <Link
          to="/tickets"
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Tickets
        </Link>
        {isAdmin && (
          <Link
            to="/users"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Users
          </Link>
        )}
      </div>
      {session && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user.name}</span>

          {!isAdmin && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                {cfg.label}
                <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-36 rounded-lg border border-gray-200 bg-white shadow-lg z-50 py-1">
                  {SELECTABLE.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${status === s ? 'font-medium' : ''}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  )
}
