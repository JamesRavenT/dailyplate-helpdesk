import fs from 'fs'
import path from 'path'
import type { Locator, Page } from '@playwright/test'
import { test } from '../fixtures/accessGate'

test.skip(!process.env.CAPTURE_SCREENSHOTS, 'set CAPTURE_SCREENSHOTS=1 to capture')

const outDir = path.resolve(__dirname, '../../../docs/assets')
const settleTimeout = 15000

fs.mkdirSync(outDir, { recursive: true })

async function settle(page: Page, ...stableElements: Locator[]): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: settleTimeout })
  for (const element of stableElements) {
    await element.waitFor({ state: 'visible', timeout: settleTimeout })
  }
}

async function capture(page: Page, filename: string): Promise<void> {
  await page.screenshot({
    path: path.join(outDir, filename),
    fullPage: true,
  })
}

test('captures the admin dashboard', async ({ page }) => {
  await page.goto('/')
  await settle(
    page,
    page.getByRole('heading', { name: /Welcome back,/i, level: 1 }),
    page.getByText('Total Tickets', { exact: true }),
  )

  await capture(page, 'dashboard-admin.png')
})

test('captures the tickets list', async ({ page }) => {
  await page.goto('/tickets')
  await settle(
    page,
    page.getByRole('heading', { name: 'Tickets', level: 1 }),
    page.getByRole('table', { name: 'Tickets' }),
  )

  await capture(page, 'tickets.png')
})

test('captures a ticket detail', async ({ page }) => {
  await page.goto('/tickets')
  const table = page.getByRole('table', { name: 'Tickets' })
  await settle(page, page.getByRole('heading', { name: 'Tickets', level: 1 }), table)

  const firstSubjectLink = table.getByRole('link').first()
  await firstSubjectLink.waitFor({ state: 'visible', timeout: settleTimeout })
  await firstSubjectLink.click()
  await settle(page, page.getByRole('heading', { level: 1 }))

  await capture(page, 'ticket-detail.png')
})

test('captures resources', async ({ page }) => {
  await page.goto('/resources')
  await settle(page, page.getByRole('heading', { name: 'Resources', level: 1 }))

  await capture(page, 'resources.png')
})

test('captures users', async ({ page }) => {
  await page.goto('/users')
  await settle(
    page,
    page.getByRole('heading', { name: 'Users', level: 1 }),
    page.getByRole('table', { name: 'Users' }),
  )

  await capture(page, 'users.png')
})

test.describe('unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('captures login', async ({ page }) => {
    await page.goto('/login')
    await settle(page, page.getByRole('button', { name: 'Sign In' }))

    await capture(page, 'login.png')
  })
})
