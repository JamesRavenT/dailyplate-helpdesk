import 'dotenv/config'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '../src/lib/prisma.ts'
import { Role } from '@prisma/client'

// Dedicated auth instance with sign-up enabled — only used here for seeding
const seedAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
})

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env')
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Admin ${email} already exists, skipping.`)
    return
  }

  const result = await seedAuth.api.signUpEmail({ body: { email, password, name: 'Administrator' } })
  if (!result?.user) throw new Error('Failed to create admin user')

  await prisma.user.update({
    where: { id: result.user.id },
    data: { role: Role.ADMIN },
  })

  console.log(`Admin created: ${email}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
