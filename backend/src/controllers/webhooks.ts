import { timingSafeEqual } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Resend } from 'resend'
import { prisma } from '../lib/prisma.ts'
import { boss, PROCESS_QUEUE } from '../lib/triage.ts'

const resend = new Resend(process.env.RESEND_API_KEY!)

// ─── shared ticket-creation / thread-continuation logic ───────────────────────

// Pull every Message-ID out of In-Reply-To / References headers. A reply's In-Reply-To
// points at the immediate parent (often the agent's outgoing email, not the original),
// but References carries the full chain including the thread root we stored as
// email_thread_id. Mail clients vary on angle brackets, so emit every form to match.
function extractMessageIds(...headers: (string | undefined)[]): string[] {
  const ids = new Set<string>()
  for (const header of headers) {
    if (!header) continue
    const tokens = header.match(/<[^>]+>/g) ?? header.split(/\s+/)
    for (const token of tokens) {
      const raw = token.trim()
      if (!raw) continue
      const stripped = raw.replace(/^<|>$/g, '')
      ids.add(raw)
      ids.add(stripped)
      ids.add(`<${stripped}>`)
    }
  }
  return [...ids]
}

async function processInboundEmail(params: {
  from_email: string
  from_name?: string
  subject: string
  body: string
  message_id?: string
  in_reply_to?: string
  references?: string
}): Promise<{ ticket_id: string; action: 'ticket_created' | 'message_added' }> {
  const { from_email, from_name, subject, body, message_id, in_reply_to, references } = params
  const now = new Date()

  const threadCandidates = extractMessageIds(in_reply_to, references)
  if (threadCandidates.length > 0) {
    const existing = await prisma.ticket.findFirst({
      where: { email_thread_id: { in: threadCandidates } },
      orderBy: { created_at: 'desc' },
    })
    if (existing) {
      const wasAiResolved = existing.status === 'AI_RESOLVED'
      await prisma.$transaction([
        prisma.message.create({
          data: { ticket_id: existing.id, body, sender_type: 'CUSTOMER', sent_at: now },
        }),
        prisma.ticket.update({
          where: { id: existing.id },
          data: {
            last_customer_reply_at: now,
            last_updated_at: now,
            summary: null,
            ...(wasAiResolved && { status: 'OPEN', assigned_to_id: null }),
          },
        }),
      ])
      return { ticket_id: existing.id, action: 'message_added' }
    }
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.create({
      data: {
        subject,
        customer_name: from_name ?? from_email,
        customer_email: from_email,
        email_thread_id: message_id ?? null,
        status: 'AI_PROCESSING',
        last_customer_reply_at: now,
        last_updated_at: now,
      },
    })
    await tx.message.create({
      data: { ticket_id: t.id, body, sender_type: 'CUSTOMER', sent_at: now },
    })
    return t
  })

  boss.send(PROCESS_QUEUE, {
    ticketId: ticket.id,
    customerName: ticket.customer_name,
    subject,
    body,
  }).catch((err) => console.error('[boss] enqueue failed for ticket', ticket.id, err))

  return { ticket_id: ticket.id, action: 'ticket_created' }
}

// ─── legacy webhook (custom X-Webhook-Secret, used for local testing) ─────────

const inboundEmailSchema = z.object({
  from_email: z.string().email('Invalid from_email').max(254),
  from_name: z.string().max(200).optional(),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required').max(100_000),
  message_id: z.string().max(500).optional(),
  in_reply_to: z.string().max(500).optional(),
  references: z.string().max(10_000).optional(),
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

    const result = await processInboundEmail(parsed.data)
    return result.action === 'ticket_created'
      ? res.status(201).json(result)
      : res.json(result)
  } catch (err) { next(err) }
}

// ─── Resend inbound webhook ────────────────────────────────────────────────────

// Parse "Display Name <email@example.com>" → { email, name }
function parseFrom(from: string): { email: string; name: string | undefined } {
  const match = from.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) {
    const name = match[1].trim() || undefined
    return { email: match[2].trim(), name }
  }
  return { email: from.trim(), name: undefined }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function resendInboundEmail(req: Request, res: Response, next: NextFunction) {
  try {
    // req.body is a raw Buffer here (express.raw applied before express.json for this route)
    const rawPayload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body)

    // Verify Resend webhook signature
    try {
      resend.webhooks.verify({
        payload: rawPayload,
        headers: {
          id: req.headers['svix-id'] as string,
          timestamp: req.headers['svix-timestamp'] as string,
          signature: req.headers['svix-signature'] as string,
        },
        webhookSecret: process.env.RESEND_INBOUND_SECRET!,
      })
    } catch {
      return res.status(401).json({ error: 'Invalid webhook signature' })
    }

    const event = JSON.parse(rawPayload) as { type: string; data: { email_id: string; from: string; subject: string; message_id?: string } }
    if (event.type !== 'email.received') {
      return res.status(200).json({ ignored: true })
    }

    // Fetch full email content (body + headers not in webhook payload)
    const { data: email, error: fetchError } = await resend.emails.receiving.get(event.data.email_id)
    if (fetchError || !email) {
      console.error('[resend] failed to fetch email content', fetchError)
      return res.status(500).json({ error: 'Failed to fetch email content' })
    }

    const body = email.text || (email.html ? stripHtml(email.html) : '')
    if (!body) {
      return res.status(200).json({ ignored: true, reason: 'empty body' })
    }

    const emailHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(email.headers ?? {})) {
      emailHeaders[k.toLowerCase()] = v
    }
    const inReplyTo = emailHeaders['in-reply-to']
    const references = emailHeaders['references']
    const messageId = event.data.message_id ?? emailHeaders['message-id']

    const { email: fromEmail, name: fromName } = parseFrom(event.data.from)

    const result = await processInboundEmail({
      from_email: fromEmail,
      from_name: fromName,
      subject: event.data.subject,
      body,
      message_id: messageId,
      in_reply_to: inReplyTo,
      references,
    })

    return res.status(200).json(result)
  } catch (err) { next(err) }
}
