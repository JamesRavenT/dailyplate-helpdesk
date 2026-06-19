import { Router } from 'express'

export const router = Router()

router.get('/', (_req, res) => {
  res.json({ message: 'Helpdesk API v1' })
})
