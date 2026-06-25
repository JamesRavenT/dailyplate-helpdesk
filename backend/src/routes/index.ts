import { Router } from 'express'
import { usersRouter } from './users.ts'
import { ticketsRouter } from './tickets.ts'
import { webhooksRouter } from './webhooks.ts'
import { articlesRouter } from './articles.ts'

export const router = Router()

router.get('/', (_req, res) => {
  res.json({ message: 'Helpdesk API v1' })
})

router.use('/users', usersRouter)
router.use('/tickets', ticketsRouter)
router.use('/webhooks', webhooksRouter)
router.use('/articles', articlesRouter)
