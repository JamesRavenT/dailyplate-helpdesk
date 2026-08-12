import { describe, expect, mock, test } from 'bun:test'
import type { JobWithMetadata } from 'pg-boss'
import {
  deriveBossStatus,
  processJobWithRetrySafety,
  type BossStatusSnapshot,
  type ProcessJobData,
} from './triage.ts'

const STATUS_NOW = new Date('2026-08-11T04:00:00.000Z')

function createStatusSnapshot(
  overrides: Partial<BossStatusSnapshot> = {},
): BossStatusSnapshot {
  return {
    startupPhase: 'started',
    startedAt: new Date(STATUS_NOW.getTime() - 5 * 60 * 1000),
    lastBossError: null,
    presenceWorker: {
      state: 'active',
      lastFetchedOn: STATUS_NOW.getTime() - 30 * 1000,
    },
    lastPresenceSweepCompletedAt: new Date(STATUS_NOW.getTime() - 60 * 1000),
    now: STATUS_NOW,
    ...overrides,
  }
}

function createJob(retryCount: number, retryLimit = 2) {
  return {
    id: 'job-1',
    data: {
      ticketId: 'ticket-1',
      customerName: 'Customer',
      subject: 'Subject',
      body: 'Body',
    },
    retryCount,
    retryLimit,
  } as JobWithMetadata<ProcessJobData>
}

describe('processJobWithRetrySafety', () => {
  test('does no AI or message work when the ticket is no longer AI_PROCESSING', async () => {
    const aiCall = mock(() => {})
    const messageCreate = mock(() => {})
    const processTicket = mock(async () => {
      aiCall()
      messageCreate()
    })
    const releaseTerminalTicket = mock(async () => {})

    await processJobWithRetrySafety(createJob(0), { status: 'OPEN' }, {
      processTicket,
      releaseTerminalTicket,
    })

    expect(processTicket).not.toHaveBeenCalled()
    expect(aiCall).not.toHaveBeenCalled()
    expect(messageCreate).not.toHaveBeenCalled()
    expect(releaseTerminalTicket).not.toHaveBeenCalled()
  })

  test('rethrows a non-terminal failure without changing ticket status', async () => {
    const originalError = new Error('temporary OpenAI failure')
    const ticket = { status: 'AI_PROCESSING', assigned_to_id: 'agent-1' as string | null }
    const releaseTerminalTicket = mock(async () => {
      ticket.status = 'OPEN'
      ticket.assigned_to_id = null
    })

    const result = processJobWithRetrySafety(createJob(1), ticket, {
      processTicket: async () => { throw originalError },
      releaseTerminalTicket,
    })

    await expect(result).rejects.toBe(originalError)
    expect(ticket).toEqual({ status: 'AI_PROCESSING', assigned_to_id: 'agent-1' })
    expect(releaseTerminalTicket).not.toHaveBeenCalled()
  })

  test('opens and unassigns the ticket on the terminal attempt, then rethrows', async () => {
    const originalError = new Error('terminal OpenAI failure')
    const ticket = { status: 'AI_PROCESSING', assigned_to_id: 'agent-1' as string | null }
    const captureException = mock((_error: unknown, _context?: unknown) => 'event-id')

    const result = processJobWithRetrySafety(createJob(2), ticket, {
      processTicket: async () => { throw originalError },
      releaseTerminalTicket: async () => {
        if (ticket.status === 'AI_PROCESSING') {
          ticket.status = 'OPEN'
          ticket.assigned_to_id = null
        }
      },
      captureException,
    })

    await expect(result).rejects.toBe(originalError)
    expect(ticket).toEqual({ status: 'OPEN', assigned_to_id: null })
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException.mock.calls[0]?.[0]).toBe(originalError)
  })

  test('reports and rethrows a terminal fallback failure', async () => {
    const originalError = new Error('terminal OpenAI failure')
    const fallbackError = new Error('database update failure')
    const captureException = mock((_error: unknown, _context?: unknown) => 'event-id')

    const result = processJobWithRetrySafety(createJob(2), { status: 'AI_PROCESSING' }, {
      processTicket: async () => { throw originalError },
      releaseTerminalTicket: async () => { throw fallbackError },
      captureException,
    })

    await expect(result).rejects.toBe(fallbackError)
    expect(captureException).toHaveBeenCalledTimes(2)
    expect(captureException.mock.calls[0]?.[0]).toBe(originalError)
    expect(captureException.mock.calls[1]?.[0]).toBe(fallbackError)
  })
})

describe('deriveBossStatus', () => {
  test('reports starting before worker registration completes', () => {
    const status = deriveBossStatus(createStatusSnapshot({
      startupPhase: 'starting',
      startedAt: null,
      presenceWorker: undefined,
      lastPresenceSweepCompletedAt: null,
    }))

    expect(status.status).toBe('starting')
    expect(status.reason).toBe('worker_starting')
  })

  test('reports healthy immediately after registration during scheduler grace', () => {
    const status = deriveBossStatus(createStatusSnapshot({
      startedAt: new Date(STATUS_NOW.getTime() - 30 * 1000),
      presenceWorker: { state: 'active', lastFetchedOn: null },
      lastPresenceSweepCompletedAt: null,
    }))

    expect(status.status).toBe('healthy')
  })

  test('reports healthy with fresh presence fetch and sweep liveness', () => {
    expect(deriveBossStatus(createStatusSnapshot()).status).toBe('healthy')
  })

  test('stays healthy after a transient error is followed by successful liveness', () => {
    const status = deriveBossStatus(createStatusSnapshot({
      lastBossError: {
        timestamp: new Date(STATUS_NOW.getTime() - 45 * 1000),
        error: new Error('recoverable polling failure'),
      },
      presenceWorker: {
        state: 'active',
        lastFetchedOn: STATUS_NOW.getTime() - 10 * 1000,
      },
      lastPresenceSweepCompletedAt: new Date(STATUS_NOW.getTime() - 20 * 1000),
    }))

    expect(status.status).toBe('healthy')
    expect(status.status).not.toBe('unhealthy')
  })

  test('reports degraded, not unhealthy, while a recent error awaits recovery proof', () => {
    const status = deriveBossStatus(createStatusSnapshot({
      lastBossError: {
        timestamp: new Date(STATUS_NOW.getTime() - 5 * 1000),
        error: new Error('recoverable polling failure'),
      },
    }))

    expect(status.status).toBe('degraded')
    expect(status.status).not.toBe('unhealthy')
  })

  test('reports unhealthy when the presence worker fetch is stale', () => {
    const status = deriveBossStatus(createStatusSnapshot({
      presenceWorker: {
        state: 'active',
        lastFetchedOn: STATUS_NOW.getTime() - 91 * 1000,
      },
    }))

    expect(status.status).toBe('unhealthy')
    expect(status.reason).toBe('presence_worker_fetch_stale')
  })

  test('reports unhealthy when completed presence sweeps are stale', () => {
    const status = deriveBossStatus(createStatusSnapshot({
      lastPresenceSweepCompletedAt: new Date(STATUS_NOW.getTime() - 181 * 1000),
    }))

    expect(status.status).toBe('unhealthy')
    expect(status.reason).toBe('presence_sweep_stale')
  })
})
