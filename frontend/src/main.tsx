import './instrument' // must be first — initialises Sentry
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p style={{ padding: '2rem' }}>Something went wrong. Please refresh the page.</p>}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
