import { Router } from 'express'
import { usersRouter } from './users.ts'

export const router = Router()

router.get('/', (_req, res) => {
  res.json({ message: 'Helpdesk API v1' })
})

router.use('/users', usersRouter)
