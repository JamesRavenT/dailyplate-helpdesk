import { Router } from 'express'
import { inboundEmail } from '../controllers/webhooks.ts'

export const webhooksRouter = Router()

webhooksRouter.post('/inbound-email', inboundEmail)
