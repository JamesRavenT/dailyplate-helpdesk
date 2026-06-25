import type { Request, Response, NextFunction } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../lib/auth.ts'
import type { SessionUser } from '../lib/auth.ts'
import { prisma } from '../lib/prisma.ts'

// Refresh an agent's presence timestamp on each authenticated request. Fire-and-forget
// so it never blocks the response; the presence sweeper flips stale agents to OFFLINE.
function touchPresence(user: SessionUser) {
  if (user.role !== 'AGENT') return
  void prisma.user
    .update({ where: { id: user.id }, data: { last_seen: new Date() } })
    .catch(() => {})
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser
      sessionId?: string
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) { res.status(401).json({ error: 'Unauthorized' }); return }
    if (!session.user.is_active) { res.status(403).json({ error: 'Account is locked' }); return }
    req.user = session.user
    req.sessionId = session.session.id
    touchPresence(session.user)
    next()
  } catch (err) { next(err) }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) { res.status(401).json({ error: 'Unauthorized' }); return }
    if (!session.user.is_active) { res.status(403).json({ error: 'Account is locked' }); return }
    if (session.user.role !== 'ADMIN') { res.status(403).json({ error: 'Forbidden' }); return }
    req.user = session.user
    req.sessionId = session.session.id
    next()
  } catch (err) { next(err) }
}
