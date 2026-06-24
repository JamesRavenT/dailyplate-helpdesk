import { config } from 'dotenv'
import * as Sentry from '@sentry/node'

// Load .env before Sentry reads process.env
config()

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  // Capture 20% of transactions in prod for performance monitoring; off in dev
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 0,
})
