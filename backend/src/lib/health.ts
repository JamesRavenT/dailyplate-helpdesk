import type { BossStatus } from './triage.ts'

export type HealthSnapshot = {
  bossStatus: BossStatus
  now: Date
  commit: string | undefined
}

export function deriveHealthResponse(snapshot: HealthSnapshot) {
  const { bossStatus } = snapshot
  const timestamp = snapshot.now.toISOString()
  const commit = snapshot.commit || null
  const worker = {
    status: bossStatus.status,
    lastFetchAt: bossStatus.lastFetchAt,
    lastSweepAt: bossStatus.lastSweepAt,
    ...(bossStatus.reason && { reason: bossStatus.reason }),
  }

  if (bossStatus.status === 'unhealthy') {
    return {
      statusCode: 503,
      body: {
        status: 'unhealthy',
        timestamp,
        commit,
        reason: bossStatus.reason,
        worker,
      },
    }
  }

  return {
    statusCode: 200,
    body: {
      status: 'ok',
      timestamp,
      commit,
      worker,
    },
  }
}
