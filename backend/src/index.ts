import './instrument.ts' // must be first — loads .env and initialises Sentry
import path from 'path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import * as Sentry from '@sentry/node'
import { toNodeHandler } from 'better-auth/node'
import { auth, trustedOrigins } from './lib/auth.ts'
import { router } from './routes/index.ts'
import { errorHandler } from './middleware/errorHandler.ts'
import { startBoss } from './lib/triage.ts'

const app = express()
const port = process.env.PORT ?? 3001

// Behind Railway's proxy — trust the first hop so req.ip / rate-limit keys use the real client IP
app.set('trust proxy', 1)

// CSP is disabled because this server also serves the built SPA (with Sentry + bundled
// assets); a misconfigured policy would silently break the deployed frontend. All other
// Helmet headers stay on. To re-enable, pass a `contentSecurityPolicy` directives object.
app.use(helmet({ contentSecurityPolicy: false }))

app.use(cors({
  origin: trustedOrigins,
  credentials: true,
}))

// Global API limiter (defence-in-depth; sign-in has its own stricter limiter below).
// Disabled under test so the E2E/integration suites aren't throttled.
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
}))

app.use('/api/auth/sign-in', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
}))

// Must be before express.json() — Better Auth parses its own request bodies
app.all('/api/auth/*', toNodeHandler(auth))

// Capture raw body for Resend webhook signature verification (must be before express.json)
app.use('/api/webhooks/resend-inbound', express.raw({ type: 'application/json' }))

app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)

// Serve the built SPA (single-service deploy). The frontend's dist/ is copied to
// ./public in the Docker image. API and health routes above always take precedence.
if (process.env.NODE_ENV === 'production') {
  const clientDir = path.resolve(import.meta.dir, '../public')
  app.use(express.static(clientDir))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next()
    res.sendFile(path.join(clientDir, 'index.html'))
  })
}

// Sentry error handler must be after all routes and before any other error middleware
Sentry.setupExpressErrorHandler(app)

app.use(errorHandler)

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`)
  startBoss().catch((err) => console.error('[boss] startup failed:', err))
})
