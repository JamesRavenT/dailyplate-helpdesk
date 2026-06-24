import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.ts'
import { listAgents, listUsers, createUser, updateUser, deleteUser, setUserLock, updateAgentStatus } from '../controllers/users.ts'

export const usersRouter = Router()
usersRouter.patch('/status', requireAuth, updateAgentStatus)
usersRouter.get('/agents', requireAdmin, listAgents)
usersRouter.get('/', requireAdmin, listUsers)
usersRouter.post('/', requireAdmin, createUser)
usersRouter.patch('/:id/lock', requireAdmin, setUserLock)
usersRouter.patch('/:id', requireAdmin, updateUser)
usersRouter.delete('/:id', requireAdmin, deleteUser)
