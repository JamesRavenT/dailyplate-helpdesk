import 'dotenv/config'
import { auth } from '../src/lib/auth.ts'
import { prisma } from '../src/lib/prisma.ts'
import { Role } from '@prisma/client'

async function createUser(email: string, password: string, name: string, role: Role) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) { console.log(`${email} already exists, skipping.`); return }

  const result = await auth.api.signUpEmail({ body: { email, password, name } })
  if (!result?.user) throw new Error(`Failed to create ${email}`)

  if (role !== Role.AGENT) {
    await prisma.user.update({ where: { id: result.user.id }, data: { role } })
  }
  console.log(`Created: ${email} (${role})`)
}

async function main() {
  await createUser('admin@helpdesk.local', 'admin123', 'Admin User', Role.ADMIN)
  await createUser('agent1@helpdesk.local', 'agent123', 'Agent One', Role.AGENT)
  await createUser('agent2@helpdesk.local', 'agent123', 'Agent Two', Role.AGENT)

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
