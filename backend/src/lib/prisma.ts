import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import type { PoolConfig } from 'pg'

function createPrismaClient() {
  const poolConfig: PoolConfig = {
    connectionString: process.env.DATABASE_URL!,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 10_000,
    query_timeout: 35_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    maxLifetimeSeconds: 300,
  }
  const adapter = new PrismaPg(poolConfig)
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
