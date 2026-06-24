/// <reference types="vite/client" />
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  // Capture 20% of transactions in prod; off in dev
  tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,
  // Capture full session replay on every error in prod
  replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
  replaysSessionSampleRate: 0,
})
