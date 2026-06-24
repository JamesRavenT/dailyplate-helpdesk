import { betterAuth } from 'better-auth'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma.ts'

// Origins allowed to call the auth API. Built from explicit env vars plus Railway's
// auto-injected RAILWAY_PUBLIC_DOMAIN (a plain env var at runtime, so it works even if a
// ${{...}} reference in FRONTEND_URL didn't resolve). Trailing slashes are stripped.
export const trustedOrigins = (() => {
  const origins = [
    process.env.FRONTEND_URL,
    process.env.BETTER_AUTH_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined,
  ]
    .filter((o): o is string => Boolean(o) && o !== 'https://')
    .map((o) => o.replace(/\/+$/, ''))

  const unique = [...new Set(origins)]
  return unique.length > 0 ? unique : ['http://localhost:5173']
})()

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
  trustedOrigins,
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
