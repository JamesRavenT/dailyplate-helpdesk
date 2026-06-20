/**
 * Global auth setup — runs once before the test suite.
 *
 * Logs in as each test user and saves the resulting browser storage state
 * (cookies + localStorage) to the .auth/ directory. Test files then restore
 * these states via storageState instead of logging in per-test.
 */

import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { USERS, ADMIN_STATE, AGENT_STATE } from '../fixtures/auth'

async function saveSession(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  storageStatePath: string,
): Promise<void> {
  await page.goto('/login')

  // Wait for the session check to finish so the form is rendered, not the
  // "Loading…" spinner.
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()

  await page.waitForURL('/')

  // Verify session was established — the navbar Sign Out button confirms it.
  await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()

  await page.context().storageState({ path: storageStatePath })
  console.log(`[auth-setup] Saved session for ${email} → ${path.basename(storageStatePath)}`)
}

setup('authenticate as admin', async ({ page }) => {
  await saveSession(page, USERS.admin.email, USERS.admin.password, ADMIN_STATE)
})

setup('authenticate as agent', async ({ page }) => {
  await saveSession(page, USERS.agent.email, USERS.agent.password, AGENT_STATE)
})
