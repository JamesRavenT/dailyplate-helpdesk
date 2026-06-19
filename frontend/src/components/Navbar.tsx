import { useNavigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'

export default function Navbar() {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await authClient.signOut()
    navigate('/login')
  }

  return (
    <nav className="border-b bg-white px-6 py-3 flex items-center justify-between">
      <span className="font-semibold text-gray-800">Helpdesk</span>
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
