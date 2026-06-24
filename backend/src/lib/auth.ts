import { betterAuth } from 'better-auth'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma.ts'

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'AGENT', input: false },
      is_active: { type: 'boolean', required: false, defaultValue: true, input: false },
      online_status: { type: 'string', required: false, defaultValue: 'OFFLINE', input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: [process.env.FRONTEND_URL ?? 'http://localhost:5173'],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email') return
      const email = ctx.body?.email as string | undefined
      if (!email) return
      const user = await prisma.user.findUnique({ where: { email }, select: { is_active: true } })
      if (user && !user.is_active) {
        throw new APIError('FORBIDDEN', { message: 'Account is locked' })
      }
    }),
  },
})

export type SessionUser = typeof auth.$Infer.Session.user
