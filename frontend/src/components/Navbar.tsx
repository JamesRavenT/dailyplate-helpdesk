import { Link, useNavigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'

export default function Navbar() {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()
  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  const handleSignOut = async () => {
    await authClient.signOut()
    navigate('/login')
  }

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
