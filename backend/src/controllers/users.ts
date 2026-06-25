import type { Request, Response, NextFunction } from 'express'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.ts'

const changeOwnPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const updateOwnProfileSchema = z.object({
  name:  z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
})

const deleteUserSchema = z.object({
  adminPassword: z.string().min(1, 'Password is required'),
})

const setUserLockSchema = z.object({
  adminPassword: z.string().min(1, 'Password is required'),
  lock: z.boolean(),
})

const editUserSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().refine(
    (val) => val === '' || val.length >= 8,
    { message: 'Password must be at least 8 characters' }
  ),
})

const createUserSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

// Private instance with sign-up enabled — used only for admin-driven user creation
const _createAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
})

const updateStatusSchema = z.object({
  status: z.enum(['ONLINE', 'AWAY', 'MEETING', 'OFFLINE']),
})

async function drainQueueForAgent(agentId: string) {
  const currentCount = await prisma.ticket.count({
    where: { assigned_to_id: agentId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
  })
  const slotsAvailable = Math.max(0, 5 - currentCount)
  if (slotsAvailable === 0) return

  const queued = await prisma.ticket.findMany({
    where: { assigned_to_id: null, status: 'OPEN' },
    orderBy: { created_at: 'asc' },
    take: slotsAvailable,
    select: { id: true },
  })
  if (queued.length === 0) return

  await prisma.ticket.updateMany({
    where: { id: { in: queued.map((t) => t.id) } },
    data: { assigned_to_id: agentId, status: 'OPEN', last_updated_at: new Date() },
  })
  console.log(`[queue] drained ${queued.length} ticket(s) → agent ${agentId}`)
}

export async function updateAgentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const { status } = parsed.data
    const agentId = req.user!.id

    await prisma.user.update({ where: { id: agentId }, data: { online_status: status } })

    if (status === 'ONLINE' || status === 'AWAY') {
      await drainQueueForAgent(agentId)
    }

    res.status(204).end()
  } catch (err) { next(err) }
}

export async function listAgents(_req: Request, res: Response, next: NextFunction) {
  try {
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT', is_active: true, id: { not: 'ai-system-agent' } },
      select: { id: true, name: true, email: true, online_status: true },
      orderBy: { name: 'asc' },
    })
    res.json(agents)
  } catch (err) { next(err) }
}

export async function listUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: 'ai-system-agent' } },
      select: { id: true, name: true, email: true, role: true, is_active: true, online_status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json(users)
  } catch (err) { next(err) }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }
    const { name, email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' })
    }

    const result = await _createAuth.api.signUpEmail({ body: { name, email, password } })
    if (!result?.user) {
      return res.status(500).json({ error: 'Failed to create user' })
    }

    const created = await prisma.user.findUniqueOrThrow({
      where: { id: result.user.id },
      select: { id: true, name: true, email: true, role: true, is_active: true, createdAt: true },
    })
    res.status(201).json(created)
  } catch (err) { next(err) }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const parsed = editUserSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }
    const { name, email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'User not found' })

    if (email !== existing.email) {
      const conflict = await prisma.user.findUnique({ where: { email } })
      if (conflict) return res.status(409).json({ error: 'Email already in use' })
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { name, email } })

      const accountData: { accountId?: string; password?: string } = {}
      if (email !== existing.email) accountData.accountId = email
      if (password) accountData.password = await hashPassword(password)

      if (Object.keys(accountData).length > 0) {
        await tx.account.updateMany({
          where: { userId: id, providerId: 'credential' },
          data: accountData,
        })
      }
    })

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { id: true, name: true, email: true, role: true, is_active: true, createdAt: true },
    })
    res.json(updated)
  } catch (err) { next(err) }
}

export async function changeOwnPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = changeOwnPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }
    const hashed = await hashPassword(parsed.data.password)
    await prisma.account.updateMany({
      where: { userId: req.user!.id, providerId: 'credential' },
      data: { password: hashed },
    })
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function updateOwnProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = updateOwnProfileSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }
    const { name, email } = parsed.data
    const existing = await prisma.user.findFirst({ where: { email, id: { not: req.user!.id } } })
    if (existing) return res.status(409).json({ error: 'Email already in use' })
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name, email },
      select: { id: true, name: true, email: true },
    })
    res.json(updated)
  } catch (err) { next(err) }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const parsed = deleteUserSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }
    const { adminPassword } = parsed.data

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (target.role === 'ADMIN') return res.status(403).json({ error: 'Cannot delete an admin account' })

    const adminAccount = await prisma.account.findFirst({
      where: { userId: req.user!.id, providerId: 'credential' },
    })
    if (!adminAccount?.password) return res.status(500).json({ error: 'Admin credential not found' })

    const valid = await verifyPassword({ hash: adminAccount.password, password: adminPassword })
    if (!valid) return res.status(401).json({ error: 'Incorrect password' })

    await prisma.$transaction([
      prisma.ticket.updateMany({ where: { assigned_to_id: id }, data: { assigned_to_id: null } }),
      prisma.user.delete({ where: { id } }),
    ])

    res.status(204).end()
  } catch (err) { next(err) }
}

export async function setUserLock(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const parsed = setUserLockSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }
    const { adminPassword, lock } = parsed.data

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (target.role === 'ADMIN') return res.status(403).json({ error: 'Cannot lock an admin account' })

    const adminAccount = await prisma.account.findFirst({
      where: { userId: req.user!.id, providerId: 'credential' },
    })
    if (!adminAccount?.password) return res.status(500).json({ error: 'Admin credential not found' })

    const valid = await verifyPassword({ hash: adminAccount.password, password: adminPassword })
    if (!valid) return res.status(401).json({ error: 'Incorrect password' })

    await prisma.user.update({
      where: { id },
      data: { is_active: !lock, ...(lock && { online_status: 'OFFLINE' }) },
    })

    if (lock) {
      await prisma.session.deleteMany({ where: { userId: id } })
    }

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { id: true, name: true, email: true, role: true, is_active: true, createdAt: true },
    })
    res.json(updated)
  } catch (err) { next(err) }
}
