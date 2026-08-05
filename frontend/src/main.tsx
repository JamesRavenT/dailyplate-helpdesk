import './instrument' // must be first — initialises Sentry
import './lib/http'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'
import App from './App.tsx'
import AccessGate from './components/AccessGate'
import { AccessGateProvider } from './context/AccessGateContext'
import { queryClient } from './lib/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p style={{ padding: '2rem' }}>Something went wrong. Please refresh the page.</p>}>
      <QueryClientProvider client={queryClient}>
        <AccessGateProvider>
          <AccessGate>
            <App />
          </AccessGate>
        </AccessGateProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
