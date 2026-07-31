import { config } from 'dotenv'
import * as Sentry from '@sentry/node'

// The E2E launcher supplies an explicit test env file. Do not let dotenv fill missing
// test values (especially OPENAI_API_KEY) from a developer's backend/.env.
// Unset/default and production startup keep the existing .env loading behavior.
if (process.env.NODE_ENV !== 'test') config()

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  // Capture 20% of transactions in prod for performance monitoring; off in dev
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 0,
})
