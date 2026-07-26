import { Router } from 'express'
import { resendInboundInternal } from '../controllers/internal.ts'

export const internalRouter = Router()

internalRouter.post('/resend-inbound', resendInboundInternal)
