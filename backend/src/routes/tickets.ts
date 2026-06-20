import { Router } from 'express'
import { requireAuth } from '../middleware/auth.ts'
import { listTickets, getTicket, updateTicket, createMessage } from '../controllers/tickets.ts'

export const ticketsRouter = Router()

ticketsRouter.get('/', requireAuth, listTickets)
ticketsRouter.get('/:id', requireAuth, getTicket)
ticketsRouter.patch('/:id', requireAuth, updateTicket)
ticketsRouter.post('/:id/messages', requireAuth, createMessage)
