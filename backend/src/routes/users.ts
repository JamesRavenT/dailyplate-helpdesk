import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.ts'
import { listUsers } from '../controllers/users.ts'

export const usersRouter = Router()
usersRouter.get('/', requireAdmin, listUsers)
