import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.ts'

export async function listUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, is_active: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json(users)
  } catch (err) { next(err) }
}
