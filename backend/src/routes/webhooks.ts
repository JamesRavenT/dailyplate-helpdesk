import { Router } from 'express'
import { inboundEmail } from '../controllers/webhooks.ts'

export const webhooksRouter = Router()

// Legacy shared-secret webhook — for local testing only; disabled in production.
if (process.env.NODE_ENV !== 'production') {
  webhooksRouter.post('/inbound-email', inboundEmail)
}
