import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '../src/lib/prisma.ts'
import { Role } from '@prisma/client'

const seedAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
})

async function createUser(email: string, password: string, name: string, role: Role) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`${email} already exists, skipping.`)
    return
  }
  const result = await seedAuth.api.signUpEmail({ body: { email, password, name } })
  if (!result?.user) throw new Error(`Failed to create ${email}`)
  if (role !== Role.AGENT) {
    await prisma.user.update({ where: { id: result.user.id }, data: { role } })
  }
  console.log(`Created ${role} user: ${email}`)
}

async function main() {
  await createUser('admin@test.com', 'Admin@731', 'Admin', Role.ADMIN)
  await createUser('agent@test.com', 'agent@731', 'Agent', Role.AGENT)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
