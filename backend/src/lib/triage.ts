import { PgBoss } from 'pg-boss'
import type { JobWithMetadata, WipData } from 'pg-boss'
import * as Sentry from '@sentry/node'
import { prisma } from './prisma.ts'
import { sendReplyToCustomer } from './email.ts'
import { processTicketWithAi, selectedAiProvider } from './ai-provider.ts'
import { assertQueueConnectionConfigured, createPgBossConfig } from './pgboss-config.ts'

export const boss = new PgBoss(createPgBossConfig())

let lastBossError: { timestamp: Date; error: Error } | null = null
let bossStartupPhase: 'starting' | 'started' = 'starting'
let startedAt: Date | null = null
let lastPresenceSweepCompletedAt: Date | null = null

const SCHEDULER_STARTUP_GRACE_MS = 2 * 60 * 1000
const PRESENCE_FETCH_MAX_AGE_MS = 90 * 1000
const PRESENCE_SWEEP_MAX_AGE_MS = 3 * 60 * 1000

boss.on('error', (error) => {
  lastBossError = { timestamp: new Date(), error }
  Sentry.captureException(error)
  console.error('[boss] error:', error)
})

export const PROCESS_QUEUE = 'process-ticket'
export const PRESENCE_SWEEP_QUEUE = 'agent-presence-sweep'
export const AI_AGENT_ID = 'ai-system-agent'

export type BossHealthStatus = 'starting' | 'healthy' | 'degraded' | 'unhealthy'

export type BossStatus = {
  status: BossHealthStatus
  reason?: string
  startedAt: string | null
  lastFetchAt: string | null
  lastSweepAt: string | null
  lastErrorAt: string | null
}

export type BossStatusSnapshot = {
  startupPhase: 'starting' | 'started'
  startedAt: Date | null
  lastBossError: { timestamp: Date; error: Error } | null
  presenceWorker: Pick<WipData, 'state' | 'lastFetchedOn'> | undefined
  lastPresenceSweepCompletedAt: Date | null
  now: Date
}

function iso(timestamp: number | Date | null | undefined): string | null {
  if (timestamp === null || timestamp === undefined) return null
  return new Date(timestamp).toISOString()
}

export function deriveBossStatus(snapshot: BossStatusSnapshot): BossStatus {
  const base = {
    startedAt: iso(snapshot.startedAt),
    lastFetchAt: iso(snapshot.presenceWorker?.lastFetchedOn),
    lastSweepAt: iso(snapshot.lastPresenceSweepCompletedAt),
    lastErrorAt: iso(snapshot.lastBossError?.timestamp),
  }

  if (snapshot.startupPhase === 'starting' || !snapshot.startedAt) {
    return { status: 'starting', reason: 'worker_starting', ...base }
  }

  if (!snapshot.presenceWorker) {
    return { status: 'unhealthy', reason: 'presence_worker_missing', ...base }
  }

  if (snapshot.presenceWorker.state !== 'active') {
    return {
      status: 'unhealthy',
      reason: `presence_worker_${snapshot.presenceWorker.state}`,
      ...base,
    }
  }

  const now = snapshot.now.getTime()
  const startupAge = now - snapshot.startedAt.getTime()
  if (startupAge <= SCHEDULER_STARTUP_GRACE_MS) {
    return { status: 'healthy', ...base }
  }

  const lastFetch = snapshot.presenceWorker.lastFetchedOn
  if (lastFetch === null) {
    return { status: 'unhealthy', reason: 'presence_worker_never_fetched', ...base }
  }
  if (now - lastFetch > PRESENCE_FETCH_MAX_AGE_MS) {
    return { status: 'unhealthy', reason: 'presence_worker_fetch_stale', ...base }
  }

  const lastSweep = snapshot.lastPresenceSweepCompletedAt?.getTime()
  if (lastSweep === undefined) {
    return { status: 'unhealthy', reason: 'presence_sweep_never_completed', ...base }
  }
  if (now - lastSweep > PRESENCE_SWEEP_MAX_AGE_MS) {
    return { status: 'unhealthy', reason: 'presence_sweep_stale', ...base }
  }

  const latestPositiveLiveness = Math.max(lastFetch, lastSweep)
  if (
    snapshot.lastBossError &&
    snapshot.lastBossError.timestamp.getTime() > latestPositiveLiveness
  ) {
    return { status: 'degraded', reason: 'boss_error_awaiting_recovery', ...base }
  }

  return { status: 'healthy', ...base }
}

export function getBossStatus(): BossStatus {
  try {
    const presenceWorker = boss
      .getWipData()
      .find((worker) => worker.name === PRESENCE_SWEEP_QUEUE)

    return deriveBossStatus({
      startupPhase: bossStartupPhase,
      startedAt,
      lastBossError,
      presenceWorker,
      lastPresenceSweepCompletedAt,
      now: new Date(),
    })
  } catch {
    return {
      status: 'unhealthy',
      reason: 'boss_wip_unavailable',
      startedAt: iso(startedAt),
      lastFetchAt: null,
      lastSweepAt: iso(lastPresenceSweepCompletedAt),
      lastErrorAt: iso(lastBossError?.timestamp),
    }
  }
}

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

async function findNextAgent(): Promise<string | null> {
  const state = await prisma.roundRobinState.upsert({
    where: { id: 1 },
    create: { id: 1, last_agent_id: null },
    update: {},
  })

  // Only ONLINE agents receive new tickets; AWAY / MEETING / OFFLINE are excluded.
  const agents = await prisma.user.findMany({
    where: {
      role: 'AGENT',
      is_active: true,
      id: { not: AI_AGENT_ID },
      online_status: 'ONLINE',
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

type RetrySafetyJob = Pick<
  JobWithMetadata<ProcessJobData>,
  'id' | 'data' | 'retryCount' | 'retryLimit'
>

type RetrySafetyOperations<Ticket extends { status: string }> = {
  processTicket: (ticket: Ticket) => Promise<void>
  releaseTerminalTicket: () => Promise<void>
  captureException?: typeof Sentry.captureException
}

export async function processJobWithRetrySafety<Ticket extends { status: string }>(
  job: RetrySafetyJob,
  ticket: Ticket | null,
  operations: RetrySafetyOperations<Ticket>,
) {
  if (!ticket || ticket.status !== 'AI_PROCESSING') {
    console.log(
      `[boss] job ${job.id} no-op — ticket ${job.data.ticketId} ${ticket ? `is ${ticket.status}` : 'is missing'}`,
    )
    return
  }

  try {
    await operations.processTicket(ticket)
  } catch (error) {
    if (job.retryCount < job.retryLimit) throw error

    const captureException = operations.captureException ?? Sentry.captureException
    const context = {
      tags: {
        'pgboss.job_id': job.id,
        'pgboss.queue': PROCESS_QUEUE,
        'ticket.id': job.data.ticketId,
      },
      extra: {
        retryCount: job.retryCount,
        retryLimit: job.retryLimit,
      },
    }

    try {
      await operations.releaseTerminalTicket()
    } catch (fallbackError) {
      captureException(error, context)
      captureException(fallbackError, {
        ...context,
        extra: {
          ...context.extra,
          originalError: error,
          terminalFallbackFailed: true,
        },
      })
      throw fallbackError
    }

    captureException(error, context)
    throw error
  }
}

async function handleProcessJobs(jobs: JobWithMetadata<ProcessJobData>[]) {
  for (const job of jobs) {
    const { ticketId } = job.data

    const ticketContact = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        status: true,
        customer_email: true,
        customer_name: true,
        email_thread_id: true,
        subject: true,
        messages: { where: { sender_type: 'CUSTOMER' }, orderBy: { sent_at: 'asc' }, take: 1, select: { body: true } },
      },
    })

    await processJobWithRetrySafety(job, ticketContact, {
      processTicket: async (activeTicket) => {
        const now = new Date()
        const allArticles = await prisma.article.findMany({ orderBy: { category: 'asc' } })
        const articleContext = allArticles.length > 0
          ? '\n\nKNOWLEDGE BASE — use the SOP below that matches the ticket category to draft accurate replies:\n\n' +
            allArticles.map((a) => `## [${a.category}] ${a.title}\n${a.content}`).join('\n\n---\n\n')
          : ''

        const customerEmail = activeTicket.customer_email
        const rawName = activeTicket.customer_name
        const subject = job.data.subject ?? activeTicket.subject
        const body = job.data.body ?? activeTicket.messages[0]?.body ?? ''

        const object = await processTicketWithAi({
          customerEmail,
          currentName: rawName,
          subject,
          body,
          articleContext,
        })

        const resolvedName = object.customerName.trim() || rawName
        const firstName = resolvedName.split(' ')[0]

        if (object.canResolve && object.reply) {
          const reply = object.reply.replace(/Dear\s+\S+,/, `Dear ${firstName},`)
          const [message] = await prisma.$transaction([
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

          sendReplyToCustomer({
            ticketId,
            messageId: message.id,
            replyType: 'ai',
            customerEmail: activeTicket.customer_email,
            customerName: resolvedName,
            subject,
            body: reply,
            emailThreadId: activeTicket.email_thread_id,
          }).catch((err) => console.error('[email] AI reply send failed', err))
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
      },
      releaseTerminalTicket: async () => {
        const { count } = await prisma.ticket.updateMany({
          where: { id: ticketId, status: 'AI_PROCESSING' },
          data: {
            status: 'OPEN',
            assigned_to_id: null,
            last_updated_at: new Date(),
          },
        })
        if (count > 0) {
          console.error(`[boss] ticket ${ticketId} → OPEN after terminal triage failure`)
        } else {
          console.log(`[boss] terminal fallback no-op — ticket ${ticketId} is no longer AI_PROCESSING`)
        }
      },
    })
  }
}

export async function startBoss() {
  bossStartupPhase = 'starting'
  startedAt = null
  lastPresenceSweepCompletedAt = null
  assertQueueConnectionConfigured()

  console.log(`[ai] provider: ${selectedAiProvider}${selectedAiProvider === 'stub' ? ' (deterministic; OpenAI module not loaded)' : ''}`)

  await ensureAiUser()
  await boss.start()
  await boss.createQueue(PROCESS_QUEUE)
  await boss.work<
    ProcessJobData,
    void,
    { batchSize: 1; includeMetadata: true }
  >(
    PROCESS_QUEUE,
    { batchSize: 1, includeMetadata: true },
    handleProcessJobs,
  )

  // Presence sweeper: every minute, mark agents idle past the timeout as OFFLINE.
  await boss.createQueue(PRESENCE_SWEEP_QUEUE)
  await boss.work(PRESENCE_SWEEP_QUEUE, async () => {
    await sweepStaleAgents()
    lastPresenceSweepCompletedAt = new Date()
  })
  await boss.schedule(PRESENCE_SWEEP_QUEUE, '* * * * *')

  startedAt = new Date()
  bossStartupPhase = 'started'
  console.log('[boss] started — process-ticket worker + presence sweeper registered')
}
