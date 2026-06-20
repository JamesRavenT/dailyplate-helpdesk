import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.ts'

const listQuerySchema = z.object({
  sortBy: z.enum(['subject', 'customer_name', 'status', 'priority', 'category', 'created_at', 'assigned_to']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  category: z.enum(['ACCOUNT', 'INQUIRY', 'REFUND', 'TECHNICAL', 'VOUCHER', 'OTHER']).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  search: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
})

const createMessageSchema = z.object({
  body: z.string().min(1, 'Reply cannot be empty'),
})

const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable().optional(),
  category: z.enum(['ACCOUNT', 'INQUIRY', 'REFUND', 'TECHNICAL', 'VOUCHER', 'OTHER']).nullable().optional(),
  assigned_to_id: z.string().nullable().optional(),
})

export async function listTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }
    const { sortBy: rawSortBy, sortOrder: rawSortOrder, category, status, search } = parsed.data
    const sortBy = rawSortBy ?? 'created_at'
    const sortOrder = rawSortOrder ?? 'desc'
    const page = Math.max(1, parseInt(parsed.data.page ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(parsed.data.pageSize ?? '10', 10) || 10))

    const primaryOrder =
      sortBy === 'assigned_to'
        ? { assigned_to: { name: sortOrder } }
        : { [sortBy]: sortOrder }
    // Secondary sort by id keeps pagination stable when primary values are equal
    const orderBy = [primaryOrder, { id: 'asc' as const }]

    const where: any = {
      ...(category && { category }),
    }

    if (req.user!.role === 'AGENT') {
      where.assigned_to_id = req.user!.id
      // Agents only see active tickets
      if (status === 'OPEN' || status === 'IN_PROGRESS') {
        where.status = status
      } else {
        where.status = { in: ['OPEN', 'IN_PROGRESS'] }
      }
    } else if (status) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { subject:        { contains: search, mode: 'insensitive' } },
        { customer_name:  { contains: search, mode: 'insensitive' } },
        { customer_email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          subject: true,
          customer_name: true,
          customer_email: true,
          status: true,
          priority: true,
          category: true,
          created_at: true,
          assigned_to: { select: { id: true, name: true, email: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ])

    res.json({ data: tickets, total, page, pageSize })
  } catch (err) { next(err) }
}

export async function createMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const parsed = createMessageSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    if (req.user!.role === 'AGENT' && ticket.assigned_to_id !== req.user!.id) {
      return res.status(403).json({ error: 'You can only reply to tickets assigned to you' })
    }

    const message = await prisma.message.create({
      data: { ticket_id: id, body: parsed.data.body, sender_type: 'AGENT' },
    })
    res.status(201).json(message)
  } catch (err) { next(err) }
}

export async function getTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { sent_at: 'asc' } },
        assigned_to: { select: { id: true, name: true } },
      },
    })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
    res.json(ticket)
  } catch (err) { next(err) }
}

export async function updateTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const parsed = updateTicketSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }

    const existing = await prisma.ticket.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Ticket not found' })

    const updated = await prisma.ticket.update({
      where: { id },
      data: parsed.data,
      include: {
        messages: { orderBy: { sent_at: 'asc' } },
        assigned_to: { select: { id: true, name: true, email: true } },
      },
    })
    res.json(updated)
  } catch (err) { next(err) }
}
