import { timingSafeEqual } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.ts'

const inboundEmailSchema = z.object({
  from_email: z.string().email('Invalid from_email').max(254),
  from_name: z.string().max(200).optional(),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required').max(100_000),
  message_id: z.string().max(500).optional(),
  in_reply_to: z.string().max(500).optional(),
})

export async function inboundEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const secret = req.headers['x-webhook-secret']
    const expected = process.env.WEBHOOK_SECRET
    const match =
      typeof secret === 'string' &&
      typeof expected === 'string' &&
      secret.length === expected.length &&
      timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
    if (!match) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const parsed = inboundEmailSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }

    const { from_email, from_name, subject, body, message_id, in_reply_to } = parsed.data
    const now = new Date()

    // Thread continuation: reply to an existing ticket
    if (in_reply_to) {
      const existing = await prisma.ticket.findUnique({
        where: { email_thread_id: in_reply_to },
      })
      if (existing) {
        await prisma.$transaction([
          prisma.message.create({
            data: { ticket_id: existing.id, body, sender_type: 'CUSTOMER', sent_at: now },
          }),
          prisma.ticket.update({
            where: { id: existing.id },
            data: { last_customer_reply_at: now, last_updated_at: now, summary: null },
          }),
        ])
        return res.json({ ticket_id: existing.id, action: 'message_added' })
      }
    }

    // New ticket
    const ticket = await prisma.$transaction(async (tx) => {
      const t = await tx.ticket.create({
        data: {
          subject,
          customer_name: from_name ?? from_email,
          customer_email: from_email,
          email_thread_id: message_id ?? null,
          last_customer_reply_at: now,
          last_updated_at: now,
        },
      })
      await tx.message.create({
        data: { ticket_id: t.id, body, sender_type: 'CUSTOMER', sent_at: now },
      })
      return t
    })

    res.status(201).json({ ticket_id: ticket.id, action: 'ticket_created' })
  } catch (err) { next(err) }
}
