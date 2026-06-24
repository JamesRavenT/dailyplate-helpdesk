import { Router } from 'express'
import { inboundEmail, resendInboundEmail } from '../controllers/webhooks.ts'

export const webhooksRouter = Router()

// Legacy shared-secret webhook — for local testing only. The production inbound path is
// Resend (signature-verified below), so this route is disabled in production.
if (process.env.NODE_ENV !== 'production') {
  webhooksRouter.post('/inbound-email', inboundEmail)
}

webhooksRouter.post('/resend-inbound', resendInboundEmail)
