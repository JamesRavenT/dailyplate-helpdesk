import { Router } from 'express'
import { inboundEmail, resendInboundEmail } from '../controllers/webhooks.ts'

export const webhooksRouter = Router()

webhooksRouter.post('/inbound-email', inboundEmail)
webhooksRouter.post('/resend-inbound', resendInboundEmail)
