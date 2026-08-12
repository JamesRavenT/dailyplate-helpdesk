import { describe, expect, test } from 'bun:test'
import { deriveHealthResponse, type HealthSnapshot } from './health.ts'

const NOW = new Date('2026-08-12T04:00:00.000Z')

function createHealthSnapshot(
  overrides: Partial<HealthSnapshot> = {},
): HealthSnapshot {
  return {
    bossStatus: {
      status: 'healthy',
      startedAt: '2026-08-12T03:55:00.000Z',
      lastFetchAt: '2026-08-12T03:59:30.000Z',
      lastSweepAt: '2026-08-12T03:59:00.000Z',
      lastErrorAt: null,
    },
    now: NOW,
    commit: undefined,
    ...overrides,
  }
}

describe('deriveHealthResponse', () => {
  test('returns 200 with an ok status when the worker is healthy', () => {
    const response = deriveHealthResponse(createHealthSnapshot())

    expect(response.statusCode).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.timestamp).toBe(NOW.toISOString())
  })

  test('returns 503 with the worker reason when the worker is unhealthy', () => {
    const response = deriveHealthResponse(createHealthSnapshot({
      bossStatus: {
        status: 'unhealthy',
        reason: 'presence_worker_missing',
        startedAt: '2026-08-12T03:55:00.000Z',
        lastFetchAt: null,
        lastSweepAt: null,
        lastErrorAt: null,
      },
    }))

    expect(response.statusCode).toBe(503)
    expect(response.body.status).toBe('unhealthy')
    expect(response.body.reason).toBe('presence_worker_missing')
  })

  test('passes through the deployed commit', () => {
    const response = deriveHealthResponse(createHealthSnapshot({
      commit: 'abc123def456',
    }))

    expect(response.body.commit).toBe('abc123def456')
  })

  test('uses null when the deployed commit is absent', () => {
    const response = deriveHealthResponse(createHealthSnapshot())

    expect(response.body.commit).toBeNull()
  })

  test('omits the worker reason when there is none', () => {
    const response = deriveHealthResponse(createHealthSnapshot())

    expect(response.body.worker).not.toHaveProperty('reason')
  })

  test('includes the worker reason when present', () => {
    const response = deriveHealthResponse(createHealthSnapshot({
      bossStatus: {
        status: 'degraded',
        reason: 'boss_error_awaiting_recovery',
        startedAt: '2026-08-12T03:55:00.000Z',
        lastFetchAt: '2026-08-12T03:59:30.000Z',
        lastSweepAt: '2026-08-12T03:59:00.000Z',
        lastErrorAt: '2026-08-12T03:59:45.000Z',
      },
    }))

    expect(response.body.worker.reason).toBe('boss_error_awaiting_recovery')
  })
})
