import './instrument.ts' // must be first — loads .env and initialises Sentry
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import * as Sentry from '@sentry/node'
import { toNodeHandler } from 'better-auth/node'
import { auth, trustedOrigins } from './lib/auth.ts'
import { router } from './routes/index.ts'
import { internalRouter } from './routes/internal.ts'
import { errorHandler } from './middleware/errorHandler.ts'
import { requireInternalToken } from './middleware/internal.ts'
import { getBossStatus, startBoss } from './lib/triage.ts'
import { deriveHealthResponse } from './lib/health.ts'

const app = express()
const port = process.env.PORT ?? 3001

// Behind Render's proxy — trust the first hop so req.ip / rate-limit keys use the real client IP
app.set('trust proxy', 1)

// CSP is disabled because this server also serves the built SPA (with Sentry + bundled
// assets); a misconfigured policy would silently break the deployed frontend. All other
// Helmet headers stay on. To re-enable, pass a `contentSecurityPolicy` directives object.
app.use(helmet({ contentSecurityPolicy: false }))

app.use(cors({
  origin: trustedOrigins,
  credentials: true,
}))

app.use('/api/internal',
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
  }),
  requireInternalToken,
  express.json({ limit: '1mb' }),
  internalRouter,
)

// Global API limiter (defence-in-depth; sign-in has its own stricter limiter below).
// Disabled under test so the E2E/integration suites aren't throttled.
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    process.env.NODE_ENV === 'test' || req.path.startsWith('/api/internal'),
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

app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))

app.get('/health', (_req, res) => {
  const now = new Date()
  const { statusCode, body } = deriveHealthResponse({
    bossStatus: getBossStatus(),
    now,
    commit: process.env.RENDER_GIT_COMMIT,
  })

  return res.status(statusCode).json(body)
})

app.use('/api', router)

// Sentry error handler must be after all routes and before any other error middleware
Sentry.setupExpressErrorHandler(app)

app.use(errorHandler)

async function start() {
  try {
    await startBoss()
    app.listen(port, () => {
      console.log(`Backend running on http://localhost:${port}`)
    })
  } catch (error) {
    console.error('[boss] startup failed:', error)
    Sentry.captureException(error)
    try {
      await Sentry.flush(2_000)
    } finally {
      process.exit(1)
    }
  }
}

void start()
