import { Navigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if ((session.user as any).role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
