import './instrument.ts' // must be first — loads .env and initialises Sentry
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import * as Sentry from '@sentry/node'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './lib/auth.ts'
import { router } from './routes/index.ts'
import { errorHandler } from './middleware/errorHandler.ts'
import { startBoss } from './lib/boss.ts'

const app = express()
const port = process.env.PORT ?? 3001

app.use(helmet())

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))

app.use('/api/auth/sign-in', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
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

// Sentry error handler must be after all routes and before any other error middleware
Sentry.setupExpressErrorHandler(app)

app.use(errorHandler)

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`)
  startBoss().catch((err) => console.error('[boss] startup failed:', err))
})
