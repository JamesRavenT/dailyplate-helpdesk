import { PrismaClient, Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const adminHash = await Bun.password.hash('admin123')
  const agentHash = await Bun.password.hash('agent123')

  await prisma.user.upsert({
    where: { email: 'admin@helpdesk.local' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@helpdesk.local',
      password_hash: adminHash,
      role: Role.ADMIN,
    },
  })

  await prisma.user.upsert({
    where: { email: 'agent1@helpdesk.local' },
    update: {},
    create: {
      name: 'Agent One',
      email: 'agent1@helpdesk.local',
      password_hash: agentHash,
      role: Role.AGENT,
    },
  })

  await prisma.user.upsert({
    where: { email: 'agent2@helpdesk.local' },
    update: {},
    create: {
      name: 'Agent Two',
      email: 'agent2@helpdesk.local',
      password_hash: agentHash,
      role: Role.AGENT,
    },
  })

  await prisma.systemConfig.upsert({
    where: { key: 'auto_close_days' },
    update: {},
    create: { key: 'auto_close_days', value: '7' },
  })

  await prisma.roundRobinState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, last_agent_id: null },
  })

  console.log('Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
