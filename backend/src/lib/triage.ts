import { PgBoss } from 'pg-boss'
import type { Job } from 'pg-boss'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { prisma } from './prisma.ts'
import { sendReplyToCustomer } from './email.ts'

export const boss = new PgBoss(process.env.DATABASE_URL!)

export const PROCESS_QUEUE = 'process-ticket'
export const PRESENCE_SWEEP_QUEUE = 'agent-presence-sweep'
export const AI_AGENT_ID = 'ai-system-agent'

// An agent whose last_seen is older than this is treated as disconnected (closed tab,
// crash, sleep, lost network) and swept to OFFLINE. Agents poll every 30s, so 2 min
// leaves comfortable margin for missed beats.
const PRESENCE_TIMEOUT_MS = 2 * 60 * 1000

// Flip agents who haven't been seen recently to OFFLINE. Writing to the DB (rather than
// computing presence at read time) means ticket routing in findNextAgent() also stops
// assigning to ghosts, and every consumer of online_status stays correct.
async function sweepStaleAgents() {
  const cutoff = new Date(Date.now() - PRESENCE_TIMEOUT_MS)
  const { count } = await prisma.user.updateMany({
    where: {
      role: 'AGENT',
      id: { not: AI_AGENT_ID },
      online_status: { not: 'OFFLINE' },
      last_seen: { lt: cutoff },
    },
    data: { online_status: 'OFFLINE' },
  })
  if (count > 0) console.log(`[presence] swept ${count} stale agent(s) → OFFLINE`)
}

async function ensureAiUser() {
  await prisma.user.upsert({
    where: { id: AI_AGENT_ID },
    update: { is_active: true },
    create: {
      id: AI_AGENT_ID,
      name: 'AI Agent',
      email: 'ai@system.internal',
      emailVerified: false,
      role: 'AGENT',
      is_active: true,
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
  customerName: z.string(),
  category: z.enum(['ACCOUNT', 'INQUIRY', 'PAYMENT', 'TECHNICAL', 'VOUCHER', 'OTHER', 'DELIVERY', 'MENU']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  canResolve: z.boolean(),
  reply: z.string(),
})

async function findNextAgent(): Promise<string | null> {
  const state = await prisma.roundRobinState.upsert({
    where: { id: 1 },
    create: { id: 1, last_agent_id: null },
    update: {},
  })

  // Only agents that are ONLINE or AWAY are "on queue"
  const agents = await prisma.user.findMany({
    where: {
      role: 'AGENT',
      is_active: true,
      id: { not: AI_AGENT_ID },
      online_status: { in: ['ONLINE', 'AWAY'] },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  })

  if (agents.length === 0) return null

  const openCounts = await prisma.ticket.groupBy({
    by: ['assigned_to_id'],
    where: {
      assigned_to_id: { in: agents.map((a) => a.id) },
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    _count: { id: true },
  })
  const countMap = new Map(openCounts.map((r) => [r.assigned_to_id!, r._count.id]))

  const lastIdx = agents.findIndex((a) => a.id === state.last_agent_id)
  const startIdx = (lastIdx + 1) % agents.length

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[(startIdx + i) % agents.length]
    if ((countMap.get(agent.id) ?? 0) < 5) return agent.id
  }

  return null
}

async function handleProcessJobs(jobs: Job<ProcessJobData>[]) {
  // Fetch all SOP articles once per batch to inject into the AI prompt.
  const allArticles = await prisma.article.findMany({ orderBy: { category: 'asc' } })
  const articleContext = allArticles.length > 0
    ? '\n\nKNOWLEDGE BASE — use the SOP below that matches the ticket category to draft accurate replies:\n\n' +
      allArticles.map((a) => `## [${a.category}] ${a.title}\n${a.content}`).join('\n\n---\n\n')
    : ''

  for (const job of jobs) {
    const { ticketId, subject, body } = job.data
    const now = new Date()

    const ticketContact = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { customer_email: true, customer_name: true, email_thread_id: true },
    })

    const customerEmail = ticketContact?.customer_email ?? ''
    const rawName = ticketContact?.customer_name ?? ''

    const { object } = await generateObject({
      model: openai('gpt-4.1-nano'),
      schema: processSchema,
      system: `You are an AI support agent for DailyPlate. For each incoming ticket you must:

1. Extract the customer's real name.
2. Classify it (category + priority).
3. Decide if you can fully resolve it with one accurate, factual reply.

CUSTOMER NAME EXTRACTION — set customerName:
- First, scan the message body for a self-introduction (e.g. "Hi, I'm Jane", "My name is John", "This is Sarah", a sign-off like "Regards, Maria").
- If no name is found in the body, derive a proper name from the email address:
  - Split on dots, underscores, hyphens, and digits
  - Capitalise each part, drop pure-number segments
  - Example: "john.doe@gmail.com" → "John Doe", "sarah_smith92@yahoo.com" → "Sarah Smith"
- Always return a clean proper name — never return the raw email address.

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
- Open with "Dear [customer first name],"
- Warm, empathetic, professional tone
- Answer clearly and completely using only factual, general information
- Close with "\\n\\nBest regards,\\nDailyPlate Support Team"

When canResolve=false, set reply to an empty string "".

Categories:
- ACCOUNT: login, account access, profile changes, password reset, subscription management
- INQUIRY: general questions, how-to, plan/pricing information
- PAYMENT: payment failures, declined cards, refund requests, billing disputes, charge reversals
- TECHNICAL: bugs, crashes, can't save changes, features not working
- VOUCHER: voucher codes, gift cards, promo/discount codes
- DELIVERY: late delivery, missing delivery, wrong order delivered
- MENU: menu questions, food selection, customisation, dietary options, meal planning
- OTHER: anything that doesn't fit the above

Priority:
- HIGH: account locked, payment failure, missing delivery, data loss, service down
- MEDIUM: late delivery, billing confusion, degraded feature, wrong order
- LOW: general questions, menu inquiries, minor issues, feature requests

When drafting a reply, follow the relevant SOP from the knowledge base exactly. If the SOP says to direct the customer to a URL, include it.${articleContext}`,
      prompt: `Customer email: ${customerEmail}
Current name on file: ${rawName}
Subject: ${subject}

Message:
${body}`,
    })

    const resolvedName = object.customerName.trim() || rawName
    const firstName = resolvedName.split(' ')[0]

    if (object.canResolve && object.reply) {
      const reply = object.reply.replace(/Dear\s+\S+,/, `Dear ${firstName},`)
      await prisma.$transaction([
        prisma.message.create({
          data: { ticket_id: ticketId, body: reply, sender_type: 'AI', sent_at: now },
        }),
        prisma.ticket.update({
          where: { id: ticketId },
          data: {
            customer_name: resolvedName,
            category: object.category,
            priority: object.priority,
            status: 'AI_RESOLVED',
            is_ai_handled: true,
            assigned_to_id: AI_AGENT_ID,
            last_updated_at: now,
          },
        }),
      ])
      console.log(`[boss] ticket ${ticketId} → AI_RESOLVED (${object.category}/${object.priority}) name="${resolvedName}"`)

      if (ticketContact) {
        sendReplyToCustomer({
          customerEmail: ticketContact.customer_email,
          customerName: resolvedName,
          subject,
          body: reply,
          emailThreadId: ticketContact.email_thread_id,
        }).catch((err) => console.error('[email] AI reply send failed', err))
      }
    } else {
      const assignedAgent = await findNextAgent()

      if (assignedAgent) {
        await prisma.$transaction([
          prisma.ticket.update({
            where: { id: ticketId },
            data: {
              customer_name: resolvedName,
              category: object.category,
              priority: object.priority,
              status: 'OPEN',
              assigned_to_id: assignedAgent,
              last_updated_at: now,
            },
          }),
          prisma.roundRobinState.upsert({
            where: { id: 1 },
            create: { id: 1, last_agent_id: assignedAgent },
            update: { last_agent_id: assignedAgent },
          }),
        ])
        console.log(`[boss] ticket ${ticketId} → OPEN (assigned to ${assignedAgent}) name="${resolvedName}"`)
      } else {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            customer_name: resolvedName,
            category: object.category,
            priority: object.priority,
            status: 'OPEN',
            last_updated_at: now,
          },
        })
        console.log(`[boss] ticket ${ticketId} → OPEN (no eligible agent) name="${resolvedName}"`)
      }
    }
  }
}

export async function startBoss() {
  boss.on('error', (err) => console.error('[boss] error:', err))

  await ensureAiUser()
  await boss.start()
  await boss.createQueue(PROCESS_QUEUE)
  await boss.work<ProcessJobData>(PROCESS_QUEUE, { batchSize: 5 }, handleProcessJobs)

  // Presence sweeper: every minute, mark agents idle past the timeout as OFFLINE.
  await boss.createQueue(PRESENCE_SWEEP_QUEUE)
  await boss.work(PRESENCE_SWEEP_QUEUE, async () => { await sweepStaleAgents() })
  await boss.schedule(PRESENCE_SWEEP_QUEUE, '* * * * *')

  console.log('[boss] started — process-ticket worker + presence sweeper registered')
}
