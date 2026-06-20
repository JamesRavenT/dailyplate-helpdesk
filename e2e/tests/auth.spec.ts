/**
 * End-to-end tests for the authentication system.
 *
 * Coverage:
 *  - Login form: happy paths, validation errors, server errors
 *  - Session persistence across page reloads
 *  - Already-authenticated redirect away from /login
 *  - Route protection: / and /users redirect to /login when unauthenticated
 *  - Role-based access: /users blocks AGENT users, allows ADMIN users
 *  - Sign-out: clears session and redirects to /login; subsequent protected
 *    route visits redirect back to /login
 */

import { test, expect, USERS } from './fixtures/auth'
import { test as unauthTest, expect as unauthExpect } from '@playwright/test'

// ============================================================================
// Login form
// ============================================================================

unauthTest.describe('Login form', () => {
  unauthTest.beforeEach(async ({ page }) => {
    await page.goto('/login')
    // Wait for the session check to finish so the form is rendered, not the
    // "Loading…" spinner.
    await unauthExpect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  // Happy paths

  unauthTest('admin can log in with valid credentials and is redirected to /', async ({ page }) => {
    await page.getByLabel('Email').fill(USERS.admin.email)
    await page.getByLabel('Password').fill(USERS.admin.password)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await page.waitForURL('/')
    await unauthExpect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
  })

  unauthTest('agent can log in with valid credentials and is redirected to /', async ({ page }) => {
    await page.getByLabel('Email').fill(USERS.agent.email)
    await page.getByLabel('Password').fill(USERS.agent.password)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await page.waitForURL('/')
    await unauthExpect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
  })

  // Server-side errors

  unauthTest('wrong password shows an error and stays on /login', async ({ page }) => {
    await page.getByLabel('Email').fill(USERS.admin.email)
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await unauthExpect(page.getByText(/invalid email or password/i)).toBeVisible()
    await unauthExpect(page).toHaveURL('/login')
  })

  unauthTest('unknown email shows an error and stays on /login', async ({ page }) => {
    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByLabel('Password').fill('somepassword')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await unauthExpect(page.getByText(/invalid email or password/i)).toBeVisible()
    await unauthExpect(page).toHaveURL('/login')
  })

  // Client-side validation

  unauthTest('submitting with empty email shows a validation error', async ({ page }) => {
    await page.getByLabel('Password').fill(USERS.admin.password)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await unauthExpect(page.getByText('Email is required')).toBeVisible()
    await unauthExpect(page).toHaveURL('/login')
  })

  unauthTest('submitting with empty password shows a validation error', async ({ page }) => {
    await page.getByLabel('Email').fill(USERS.admin.email)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await unauthExpect(page.getByText('Password is required')).toBeVisible()
    await unauthExpect(page).toHaveURL('/login')
  })

  unauthTest('submitting with an invalid email format shows a validation error', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Password').fill(USERS.admin.password)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await unauthExpect(page.getByText('Enter a valid email')).toBeVisible()
    await unauthExpect(page).toHaveURL('/login')
  })

  unauthTest('submitting completely empty form shows both validation errors', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign In' }).click()

    await unauthExpect(page.getByText('Email is required')).toBeVisible()
    await unauthExpect(page.getByText('Password is required')).toBeVisible()
    await unauthExpect(page).toHaveURL('/login')
  })

  // Button state during submission

  unauthTest('Sign In button is disabled and shows "Signing in…" while submitting', async ({ page }) => {
    await page.getByLabel('Email').fill(USERS.admin.email)
    await page.getByLabel('Password').fill(USERS.admin.password)

    // Intercept the auth request to hold it open long enough to observe the
    // button's intermediate state.
    await page.route('**/api/auth/sign-in/email', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      await route.continue()
    })

    await page.getByRole('button', { name: 'Sign In' }).click()

    await unauthExpect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled()

    await page.waitForURL('/')
  })
})

// ============================================================================
// Session persistence
// ============================================================================

test.describe('Session persistence', () => {
  test('authenticated user remains logged in after a full page reload', async ({ adminPage }) => {
    await adminPage.goto('/')
    await expect(adminPage.getByRole('button', { name: 'Sign Out' })).toBeVisible()

    await adminPage.reload()

    await expect(adminPage.getByRole('button', { name: 'Sign Out' })).toBeVisible()
  })

  test('visiting /login while already authenticated redirects to /', async ({ adminPage }) => {
    await adminPage.goto('/login')
    await adminPage.waitForURL('/')
    await expect(adminPage.getByRole('button', { name: 'Sign Out' })).toBeVisible()
  })
})

// ============================================================================
// Route protection — unauthenticated visitors
// ============================================================================

unauthTest.describe('Route protection (unauthenticated)', () => {
  unauthTest('visiting / without a session redirects to /login', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL('/login')
    await unauthExpect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  unauthTest('visiting /users without a session redirects to /login', async ({ page }) => {
    await page.goto('/users')
    await page.waitForURL('/login')
    await unauthExpect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })
})

// ============================================================================
// Role-based access control
// ============================================================================

test.describe('Role-based access control', () => {
  test('admin can access /users', async ({ adminPage }) => {
    await adminPage.goto('/users')
    await expect(adminPage.getByRole('heading', { name: 'Users' })).toBeVisible()
    await expect(adminPage).toHaveURL('/users')
  })

  test('admin sees the Users link in the navbar', async ({ adminPage }) => {
    await adminPage.goto('/')
    await expect(adminPage.getByRole('link', { name: 'Users' })).toBeVisible()
  })

  test('agent visiting /users is redirected to /', async ({ agentPage }) => {
    await agentPage.goto('/users')
    await agentPage.waitForURL('/')
    await expect(agentPage.getByRole('button', { name: 'Sign Out' })).toBeVisible()
    await expect(agentPage).toHaveURL('/')
  })

  test('agent does not see the Users link in the navbar', async ({ agentPage }) => {
    await agentPage.goto('/')
    await expect(agentPage.getByRole('link', { name: 'Users' })).not.toBeVisible()
  })
})

// ============================================================================
// Sign-out
// ============================================================================

// These tests do a fresh login each time rather than reusing stored sessions.
// Better Auth sessions are server-side (DB rows), so signing out deletes the
// session record — any subsequent test loading the same stored cookie would
// hit an invalid session and never see the Sign Out button.
unauthTest.describe('Sign-out', () => {
  async function freshSignIn(page: import('@playwright/test').Page) {
    await page.goto('/login')
    await unauthExpect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    await page.getByLabel('Email').fill(USERS.admin.email)
    await page.getByLabel('Password').fill(USERS.admin.password)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('/')
  }

  unauthTest('clicking Sign Out navigates to /login', async ({ page }) => {
    await freshSignIn(page)
    await page.getByRole('button', { name: 'Sign Out' }).click()

    await page.waitForURL('/login')
    await unauthExpect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  unauthTest('after sign-out, visiting / redirects back to /login', async ({ page }) => {
    await freshSignIn(page)
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await page.waitForURL('/login')

    await page.goto('/')
    await page.waitForURL('/login')
    await unauthExpect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  unauthTest('after sign-out, visiting /users redirects back to /login', async ({ page }) => {
    await freshSignIn(page)
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await page.waitForURL('/login')

    await page.goto('/users')
    await page.waitForURL('/login')
    await unauthExpect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })
})

test.describe('User identity', () => {
  test('home page shows the signed-in user name', async ({ adminPage }) => {
    await adminPage.goto('/')
    await expect(adminPage.getByText(USERS.admin.name, { exact: true })).toBeVisible()
  })
})
