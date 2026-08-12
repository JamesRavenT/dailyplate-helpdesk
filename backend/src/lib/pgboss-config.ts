import type { PoolConfig } from 'pg'
import type { ConstructorOptions } from 'pg-boss'

export type PgBossConfig = ConstructorOptions & PoolConfig

export function assertQueueConnectionConfigured() {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL_UNPOOLED?.trim()) {
    throw new Error(
      'DATABASE_URL_UNPOOLED is required in production. Set it to the direct (unpooled) Neon Postgres connection string so pg-boss can run reliably outside PgBouncer.',
    )
  }
}

export function createPgBossConfig(): PgBossConfig {
  const connectionString = process.env.NODE_ENV === 'production'
    ? process.env.DATABASE_URL_UNPOOLED
    : process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

  return {
    connectionString,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    query_timeout: 35_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    maxLifetimeSeconds: 300,
    max: 5,
    useListenNotify: false,
  }
}
