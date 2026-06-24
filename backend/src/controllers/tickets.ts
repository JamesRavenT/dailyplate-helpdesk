import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.ts'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { sendReplyToCustomer } from '../lib/email.ts'

const listQuerySchema = z.object({
  sortBy: z.enum(['subject', 'customer_name', 'status', 'priority', 'category', 'created_at', 'last_updated_at', 'assigned_to']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  category: z.enum(['ACCOUNT', 'INQUIRY', 'REFUND', 'TECHNICAL', 'VOUCHER', 'OTHER']).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'AI_RESOLVED']).optional(),
  search: z.string().max(200).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
})

const createMessageSchema = z.object({
  body: z.string().min(1, 'Reply cannot be empty').max(20_000, 'Reply is too long'),
})

const polishReplySchema = z.object({
  body: z.string().min(1, 'Reply cannot be empty').max(20_000, 'Reply is too long'),
})

const adminUpdateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable().optional(),
  category: z.enum(['ACCOUNT', 'INQUIRY', 'REFUND', 'TECHNICAL', 'VOUCHER', 'OTHER']).nullable().optional(),
  assigned_to_id: z.string().nullable().optional(),
})

const agentUpdateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable().optional(),
  category: z.enum(['ACCOUNT', 'INQUIRY', 'REFUND', 'TECHNICAL', 'VOUCHER', 'OTHER']).nullable().optional(),
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
        : sortBy === 'last_updated_at'
        ? { last_updated_at: { sort: sortOrder, nulls: 'last' as const } }
        : { [sortBy]: sortOrder }
    // Secondary sort by id keeps pagination stable when primary values are equal
    const orderBy = [primaryOrder, { id: 'asc' as const }]

    const where: any = {
      ...(category && { category }),
    }

    if (req.user!.role === 'AGENT') {
      where.assigned_to_id = req.user!.id
      // Agents only see active tickets (AI statuses are excluded implicitly)
      if (status === 'OPEN' || status === 'IN_PROGRESS') {
        where.status = status
      } else {
        where.status = { in: ['OPEN', 'IN_PROGRESS'] }
      }
    } else {
      // Hide AI_PROCESSING from admins — ticket is mid-resolution, prevent agent interference
      where.status = status ?? { not: 'AI_PROCESSING' }
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
          last_updated_at: true,
          is_ai_handled: true,
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
    await prisma.ticket.update({ where: { id }, data: { last_updated_at: message.sent_at } })
    res.status(201).json(message)

    sendReplyToCustomer({
      customerEmail: ticket.customer_email,
      customerName: ticket.customer_name,
      subject: ticket.subject,
      body: parsed.data.body,
      emailThreadId: ticket.email_thread_id,
    }).catch((err) => console.error('[email] agent reply send failed', err))
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

    if (req.user!.role === 'AGENT' && ticket.assigned_to_id !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    res.json(ticket)
  } catch (err) { next(err) }
}

export async function summarizeTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { sent_at: 'asc' } } },
    })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    if (req.user!.role === 'AGENT' && ticket.assigned_to_id !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const thread = ticket.messages
      .map(m => `[${m.sender_type}]: ${m.body}`)
      .join('\n\n')

    const { text } = await generateText({
      model: openai('gpt-4.1-nano'),
      system: `You are a helpdesk assistant. Summarize the support ticket concisely in 2–4 sentences covering: the customer's issue, what has been done so far, and the current status. Be factual and neutral. Return only the summary with no preamble.`,
      prompt: `Ticket subject: ${ticket.subject}\nStatus: ${ticket.status}\nPriority: ${ticket.priority ?? 'None'}\nCategory: ${ticket.category ?? 'None'}\n\nMessage thread:\n${thread || '(no messages yet)'}`,
    })

    await prisma.ticket.update({ where: { id }, data: { summary: text } })

    res.json({ summary: text })
  } catch (err) { next(err) }
}

export async function polishReply(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const parsed = polishReplySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { sent_at: 'asc' } } },
    })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    if (req.user!.role === 'AGENT' && ticket.assigned_to_id !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const thread = ticket.messages
      .map(m => `[${m.sender_type}]: ${m.body}`)
      .join('\n\n')

    const { text } = await generateText({
      model: openai('gpt-4.1-nano'),
      system: `You are a professional helpdesk support agent assistant. Your job is to polish and improve draft replies written by support agents. Make replies clear, empathetic, professional, and concise. Keep the agent's core message and intent intact — only improve the tone, grammar, and clarity. Return only the improved reply text with no commentary or preamble.`,
      prompt: `Ticket subject: ${ticket.subject}\n\nConversation so far:\n${thread || '(no messages yet)'}\n\nAgent's draft reply:\n${parsed.data.body}`,
    })

    res.json({ polished: text })
  } catch (err) { next(err) }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!

    if (user.role === 'ADMIN') {
      const [total, ongoing, resolvedByAI, resolvedByAgents, critical] = await Promise.all([
        prisma.ticket.count({ where: { status: { not: 'AI_PROCESSING' } } }),
        prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.ticket.count({
          where: {
            OR: [
              { status: 'AI_RESOLVED' },
              { status: 'RESOLVED', is_ai_handled: true },
            ],
          },
        }),
        prisma.ticket.count({ where: { status: 'RESOLVED', is_ai_handled: false } }),
        prisma.ticket.count({
          where: {
            severity: 'CRITICAL',
            status: { notIn: ['RESOLVED', 'CLOSED', 'AI_RESOLVED'] },
          },
        }),
      ])
      return res.json({ total, ongoing, resolvedByAI, resolvedByAgents, critical })
    }

    // Agent
    const agentId = user.id
    const [total, ongoing, resolved, openTickets] = await Promise.all([
      prisma.ticket.count({ where: { assigned_to_id: agentId } }),
      prisma.ticket.count({ where: { assigned_to_id: agentId, status: 'IN_PROGRESS' } }),
      prisma.ticket.count({ where: { assigned_to_id: agentId, status: 'RESOLVED' } }),
      prisma.ticket.findMany({
        where: { assigned_to_id: agentId, status: 'OPEN' },
        orderBy: [
          { last_updated_at: { sort: 'desc', nulls: 'last' } },
          { created_at: 'desc' },
        ],
        take: 5,
        select: {
          id: true,
          subject: true,
          customer_name: true,
          status: true,
          priority: true,
          created_at: true,
          last_updated_at: true,
        },
      }),
    ])
    return res.json({ total, ongoing, resolved, openTickets })
  } catch (err) { next(err) }
}

export async function getTicketsByIds(req: Request, res: Response, next: NextFunction) {
  try {
    const ids = (req.query.ids as string ?? '').split(',').filter(Boolean).slice(0, 10)
    if (ids.length === 0) return res.json([])

    const where: any = { id: { in: ids } }
    if (req.user!.role === 'AGENT') {
      where.assigned_to_id = req.user!.id
    }

    const tickets = await prisma.ticket.findMany({
      where,
      select: {
        id: true,
        subject: true,
        customer_name: true,
        status: true,
        priority: true,
        created_at: true,
        last_updated_at: true,
      },
    })

    // Return in the same order as requested
    const byId = new Map(tickets.map(t => [t.id, t]))
    return res.json(ids.map(id => byId.get(id)).filter(Boolean))
  } catch (err) { next(err) }
}

export async function updateTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const isAdmin = req.user!.role === 'ADMIN'
    const schema = isAdmin ? adminUpdateTicketSchema : agentUpdateTicketSchema
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }

    const existing = await prisma.ticket.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Ticket not found' })

    if (!isAdmin && existing.assigned_to_id !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Validate the target user is an active agent before assigning
    if (isAdmin) {
      const adminData = parsed.data as z.infer<typeof adminUpdateTicketSchema>
      if (adminData.assigned_to_id != null) {
        const target = await prisma.user.findUnique({
          where: { id: adminData.assigned_to_id },
          select: { role: true, is_active: true },
        })
        if (!target || target.role !== 'AGENT' || !target.is_active) {
          return res.status(400).json({ error: 'Invalid agent' })
        }
      }
    }

    const hasMeaningfulChange =
      'status' in parsed.data ||
      'priority' in parsed.data ||
      'category' in parsed.data

    const updated = await prisma.ticket.update({
      where: { id },
      data: { ...parsed.data, ...(hasMeaningfulChange && { last_updated_at: new Date() }) },
      include: {
        messages: { orderBy: { sent_at: 'asc' } },
        assigned_to: { select: { id: true, name: true, email: true } },
      },
    })
    res.json(updated)
  } catch (err) { next(err) }
}
