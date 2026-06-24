import { PgBoss } from 'pg-boss'
import type { Job } from 'pg-boss'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { prisma } from './prisma.ts'

export const boss = new PgBoss(process.env.DATABASE_URL!)

export const PROCESS_QUEUE = 'process-ticket'
export const AI_AGENT_ID = 'ai-system-agent'

async function ensureAiUser() {
  await prisma.user.upsert({
    where: { id: AI_AGENT_ID },
    update: {},
    create: {
      id: AI_AGENT_ID,
      name: 'AI Agent',
      email: 'ai@system.internal',
      emailVerified: false,
      role: 'AGENT',
      is_active: false,
    },
  })
}

export type ProcessJobData = {
  ticketId: string
  customerName: string
  subject: string
  body: string
}

const processSchema = z.object({
  category: z.enum(['ACCOUNT', 'INQUIRY', 'REFUND', 'TECHNICAL', 'VOUCHER', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  canResolve: z.boolean(),
  reply: z.string(),
})

async function handleProcessJobs(jobs: Job<ProcessJobData>[]) {
  for (const job of jobs) {
    const { ticketId, customerName, subject, body } = job.data
    const firstName = customerName.split(' ')[0]
    const now = new Date()

    const { object } = await generateObject({
      model: openai('gpt-4.1-nano'),
      schema: processSchema,
      system: `You are an AI support agent for KaKuBiz. For each incoming ticket you must:

1. Classify it (category + priority).
2. Decide if you can fully resolve it with one accurate, factual reply.

IMPORTANT: You have NO access to customer accounts, billing systems, or internal data. You cannot process refunds, reset passwords, investigate charges, or take any action on behalf of the customer. Never pretend you have done something you cannot do.

Set canResolve=true ONLY when the answer requires zero account-specific knowledge:
- How-to questions about publicly documented features
- General subscription/plan/pricing information (tiers, what's included)
- Cancellation or refund policy questions (policy explanation only, NOT processing a refund)
- Voucher code instructions

Set canResolve=false for ANYTHING that requires looking up or acting on a specific account:
- Refund requests or billing disputes ("I was charged twice", "charge me back")
- Account access issues (locked out, password reset, wrong email)
- Bug reports or technical issues needing investigation
- Questions about a specific transaction, invoice, or order
- Any request that implies taking an action ("please cancel my account", "please refund me")

When canResolve=true, write a complete reply in the reply field:
- Open with "Dear ${firstName},"
- Warm, empathetic, professional tone
- Answer clearly and completely using only factual, general information
- Close with "\\n\\nBest regards,\\nKaKuBiz Support Team"

When canResolve=false, set reply to an empty string "".

Categories:
- ACCOUNT: login, account access, profile, password
- INQUIRY: general questions, how-to, subscription/plan questions
- REFUND: refund requests, billing disputes, charge reversals
- TECHNICAL: bugs, crashes, integrations, features not working
- VOUCHER: voucher/discount/promo codes
- OTHER: anything else

Priority:
- HIGH: account locked, payment failure, data loss, service down
- MEDIUM: billing confusion, degraded feature, inconvenient issue
- LOW: general questions, minor issues, feature requests`,
      prompt: `Customer name: ${customerName}
Subject: ${subject}

Message:
${body}`,
    })

    if (object.canResolve && object.reply) {
      await prisma.$transaction([
        prisma.message.create({
          data: { ticket_id: ticketId, body: object.reply, sender_type: 'AI', sent_at: now },
        }),
        prisma.ticket.update({
          where: { id: ticketId },
          data: {
            category: object.category,
            priority: object.priority,
            status: 'AI_RESOLVED',
            is_ai_handled: true,
            assigned_to_id: AI_AGENT_ID,
            last_updated_at: now,
          },
        }),
      ])
      console.log(`[boss] ticket ${ticketId} → AI_RESOLVED (${object.category}/${object.priority})`)
    } else {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          category: object.category,
          priority: object.priority,
          status: 'OPEN',
          last_updated_at: now,
        },
      })
      console.log(`[boss] ticket ${ticketId} → OPEN (${object.category}/${object.priority})`)
    }
  }
}

export async function startBoss() {
  boss.on('error', (err) => console.error('[boss] error:', err))

  await ensureAiUser()
  await boss.start()
  await boss.createQueue(PROCESS_QUEUE)
  await boss.work<ProcessJobData>(PROCESS_QUEUE, { batchSize: 5 }, handleProcessJobs)

  console.log('[boss] started — process-ticket worker registered')
}
