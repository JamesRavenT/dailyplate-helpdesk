import { Router } from 'express'
import { requireAuth } from '../middleware/auth.ts'
import { listTickets, getTicket, getStats, getTicketsByIds, updateTicket, createMessage, polishReply, summarizeTicket } from '../controllers/tickets.ts'

export const ticketsRouter = Router()

ticketsRouter.get('/stats', requireAuth, getStats)
ticketsRouter.get('/by-ids', requireAuth, getTicketsByIds)
ticketsRouter.get('/', requireAuth, listTickets)
ticketsRouter.get('/:id', requireAuth, getTicket)
ticketsRouter.patch('/:id', requireAuth, updateTicket)
ticketsRouter.post('/:id/messages', requireAuth, createMessage)
ticketsRouter.post('/:id/polish', requireAuth, polishReply)
ticketsRouter.post('/:id/summarize', requireAuth, summarizeTicket)
