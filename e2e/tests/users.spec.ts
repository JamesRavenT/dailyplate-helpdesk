/**
 * End-to-end tests for the user management system (happy paths).
 *
 * Coverage:
 *  - Create: admin creates a new agent via the Create User dialog
 *  - Edit: admin updates an agent's name and email
 *  - Lock: admin locks an agent (logs them out, prevents sign-in)
 *  - Unlock: admin unlocks a previously locked agent
 *  - Delete: admin deletes an agent
 *
 * Each test creates its own unique user so tests are independent on a
 * persistent test database (re-runs do not conflict).
 */

import { test, expect, USERS } from './fixtures/auth'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function createUser(
  page: import('@playwright/test').Page,
  name: string,
  email: string,
  password: string
) {
  await page.goto('/users')
  await page.getByRole('button', { name: 'Create User' }).click()
  await page.locator('#cu-name').fill(name)
  await page.locator('#cu-email').fill(email)
  await page.locator('#cu-password').fill(password)
  // Two "Create User" buttons exist when the dialog is open (page-level + dialog
  // submit). The dialog submit is always last in the DOM since it is portal-rendered.
  await page.getByRole('button', { name: 'Create User' }).last().click()
  await expect(page.getByRole('cell', { name, exact: true })).toBeVisible()
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('User Management', () => {
  test('admin can create a new agent', async ({ adminPage: page }) => {
    const suffix = Date.now()
    const name = `E2E User ${suffix}`
    const email = `e2e-${suffix}@test.com`

    await createUser(page, name, email, 'Password123')

    const row = page.getByRole('row').filter({ hasText: name })
    await expect(row.getByText('AGENT')).toBeVisible()
    await expect(row.getByText('Active')).toBeVisible()
  })

  test('admin can edit an agent name and email', async ({ adminPage: page }) => {
    const suffix = Date.now()
    const name = `E2E User ${suffix}`
    const email = `e2e-${suffix}@test.com`
    await createUser(page, name, email, 'Password123')

    const updatedName = `E2E Edited ${suffix}`
    const updatedEmail = `e2e-edited-${suffix}@test.com`

    await page.getByRole('button', { name: `Edit ${name}` }).click()
    await page.locator('#eu-name').clear()
    await page.locator('#eu-name').fill(updatedName)
    await page.locator('#eu-email').clear()
    await page.locator('#eu-email').fill(updatedEmail)
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await expect(page.locator('#eu-name')).not.toBeVisible()
    await expect(page.getByRole('cell', { name: updatedName, exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name, exact: true })).not.toBeVisible()
  })

  test('admin can lock an agent', async ({ adminPage: page }) => {
    const suffix = Date.now()
    const name = `E2E User ${suffix}`
    const email = `e2e-${suffix}@test.com`
    await createUser(page, name, email, 'Password123')

    await page.getByRole('button', { name: `Lock ${name}` }).click()
    await page.locator('#lu-password').fill(USERS.admin.password)
    await page.getByRole('button', { name: 'Lock Agent' }).click()

    await expect(page.locator('#lu-password')).not.toBeVisible()

    const row = page.getByRole('row').filter({ hasText: name })
    await expect(row.getByText('Inactive')).toBeVisible()
    await expect(page.getByRole('button', { name: `Unlock ${name}` })).toBeVisible()
  })

  test('admin can unlock a locked agent', async ({ adminPage: page }) => {
    const suffix = Date.now()
    const name = `E2E User ${suffix}`
    const email = `e2e-${suffix}@test.com`
    await createUser(page, name, email, 'Password123')

    // Lock first
    await page.getByRole('button', { name: `Lock ${name}` }).click()
    await page.locator('#lu-password').fill(USERS.admin.password)
    await page.getByRole('button', { name: 'Lock Agent' }).click()
    await expect(page.locator('#lu-password')).not.toBeVisible()

    // Unlock
    await page.getByRole('button', { name: `Unlock ${name}` }).click()
    await page.locator('#lu-password').fill(USERS.admin.password)
    await page.getByRole('button', { name: 'Unlock Agent' }).click()
    await expect(page.locator('#lu-password')).not.toBeVisible()

    const row = page.getByRole('row').filter({ hasText: name })
    await expect(row.getByText('Active')).toBeVisible()
    await expect(page.getByRole('button', { name: `Lock ${name}` })).toBeVisible()
  })

  test('admin can delete an agent', async ({ adminPage: page }) => {
    const suffix = Date.now()
    const name = `E2E User ${suffix}`
    const email = `e2e-${suffix}@test.com`
    await createUser(page, name, email, 'Password123')

    await page.getByRole('button', { name: `Delete ${name}` }).click()
    await page.locator('#du-password').fill(USERS.admin.password)
    await page.getByRole('button', { name: 'Delete User' }).click()

    await expect(page.locator('#du-password')).not.toBeVisible()
    await expect(page.getByRole('cell', { name, exact: true })).not.toBeVisible()
  })
})
