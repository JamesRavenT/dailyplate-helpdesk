import 'dotenv/config'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { AgentStatus, Role } from '@prisma/client'
import { prisma } from '../src/lib/prisma.ts'

const DEMO_PASSWORD = 'agent@731'

const seedAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
})

const DEMO_AGENTS = [
  {
    name: 'Priya Nair',
    email: 'priya.nair@dailyplate.example',
    is_active: true,
    online_status: AgentStatus.ONLINE,
    createdAt: new Date('2025-12-27T00:00:00.000Z'),
  },
  {
    name: 'Marcus Reid',
    email: 'marcus.reid@dailyplate.example',
    is_active: true,
    online_status: AgentStatus.AWAY,
    createdAt: new Date('2026-01-26T00:00:00.000Z'),
  },
  {
    name: 'Sofia Alvarez',
    email: 'sofia.alvarez@dailyplate.example',
    is_active: true,
    online_status: AgentStatus.MEETING,
    createdAt: new Date('2026-02-25T00:00:00.000Z'),
  },
  {
    name: 'Daniel Kim',
    email: 'daniel.kim@dailyplate.example',
    is_active: false,
    online_status: AgentStatus.OFFLINE,
    createdAt: new Date('2026-04-21T00:00:00.000Z'),
  },
  {
    name: 'Amara Okonkwo',
    email: 'amara.okonkwo@dailyplate.example',
    is_active: true,
    online_status: AgentStatus.OFFLINE,
    createdAt: new Date('2026-05-26T00:00:00.000Z'),
  },
]

async function main() {
  for (const agent of DEMO_AGENTS) {
    const existing = await prisma.user.findUnique({ where: { email: agent.email } })
    if (existing) {
      console.log(`${agent.email} already exists, skipping.`)
      continue
    }

    const result = await seedAuth.api.signUpEmail({
      body: { email: agent.email, password: DEMO_PASSWORD, name: agent.name },
    })
    if (!result?.user) throw new Error(`Failed to create ${agent.email}`)

    await prisma.user.update({
      where: { id: result.user.id },
      data: {
        role: Role.AGENT,
        is_active: agent.is_active,
        online_status: agent.online_status,
        createdAt: agent.createdAt,
      },
    })
    console.log(`Created ${Role.AGENT} user: ${agent.email}`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
