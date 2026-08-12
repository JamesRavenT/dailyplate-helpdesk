import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { assertQueueConnectionConfigured, createPgBossConfig } from './pgboss-config.ts'

describe('createPgBossConfig', () => {
  let originalNodeEnv: string | undefined
  let originalDatabaseUrl: string | undefined
  let originalDatabaseUrlUnpooled: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    originalDatabaseUrl = process.env.DATABASE_URL
    originalDatabaseUrlUnpooled = process.env.DATABASE_URL_UNPOOLED
  })

  afterEach(() => {
    setOrDeleteEnv('NODE_ENV', originalNodeEnv)
    setOrDeleteEnv('DATABASE_URL', originalDatabaseUrl)
    setOrDeleteEnv('DATABASE_URL_UNPOOLED', originalDatabaseUrlUnpooled)
  })

  test('validation throws when DATABASE_URL_UNPOOLED is missing in production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.DATABASE_URL_UNPOOLED

    expect(() => assertQueueConnectionConfigured()).toThrow('DATABASE_URL_UNPOOLED is required in production')
  })

  test('config creation does not throw when DATABASE_URL_UNPOOLED is missing in production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.DATABASE_URL_UNPOOLED

    expect(() => createPgBossConfig()).not.toThrow()
    expect(createPgBossConfig().connectionString).toBeUndefined()
  })

  test('falls back to DATABASE_URL outside production', () => {
    process.env.NODE_ENV = 'test'
    delete process.env.DATABASE_URL_UNPOOLED
    process.env.DATABASE_URL = 'postgresql://pooled.example/test'

    expect(createPgBossConfig().connectionString).toBe('postgresql://pooled.example/test')
  })

  test('includes the queue connection protections', () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL_UNPOOLED = 'postgresql://direct.example/test'

    expect(createPgBossConfig()).toMatchObject({
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 10_000,
      statement_timeout: 30_000,
      query_timeout: 35_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      maxLifetimeSeconds: 300,
      max: 5,
      useListenNotify: false,
    })
  })
})

function setOrDeleteEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
