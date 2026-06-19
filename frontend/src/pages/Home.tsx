import Navbar from '../components/Navbar'
import { authClient } from '../lib/auth-client'

export default function Home() {
  const { data: session } = authClient.useSession()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {session?.user.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{session?.user.email}</p>
      </main>
    </div>
  )
}
