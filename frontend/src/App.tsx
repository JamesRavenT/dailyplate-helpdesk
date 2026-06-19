import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import NotFound from './pages/NotFound.tsx'

type HealthStatus = 'loading' | 'ok' | 'error'

function HealthCheck() {
  const [status, setStatus] = useState<HealthStatus>('loading')
  const [timestamp, setTimestamp] = useState<string | null>(null)

  useEffect(() => {
    fetch('/health')
      .then((res) => res.json())
      .then((data) => {
        setStatus('ok')
        setTimestamp(data.timestamp)
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="rounded-xl border bg-white p-8 shadow-sm text-center space-y-2">
        <h1 className="text-xl font-semibold text-gray-800">Helpdesk API</h1>
        {status === 'loading' && (
          <p className="text-gray-500">Checking backend...</p>
        )}
        {status === 'ok' && (
          <>
            <p className="text-green-600 font-medium">Backend is online</p>
            <p className="text-sm text-gray-400">{timestamp}</p>
          </>
        )}
        {status === 'error' && (
          <p className="text-red-500 font-medium">Backend unreachable</p>
        )}
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HealthCheck />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
