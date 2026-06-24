import { Navigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
