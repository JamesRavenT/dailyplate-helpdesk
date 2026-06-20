import { test as base, type Page } from '@playwright/test'
import path from 'path'

// Seeded test credentials — created by backend/prisma/seed-test.ts
export const USERS = {
  admin: {
    email: 'admin@test.com',
    password: 'Admin@731',
    name: 'Admin',
    role: 'ADMIN' as const,
  },
  agent: {
    email: 'agent@test.com',
    password: 'agent@731',
    name: 'Agent',
    role: 'AGENT' as const,
  },
} as const

// Storage-state file paths — written by auth-setup.ts, consumed here
export const ADMIN_STATE = path.join(__dirname, '../../.auth/admin.json')
export const AGENT_STATE = path.join(__dirname, '../../.auth/agent.json')

type AuthFixtures = {
  adminPage: Page
  agentPage: Page
}

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },

  agentPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: AGENT_STATE })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect } from '@playwright/test'
