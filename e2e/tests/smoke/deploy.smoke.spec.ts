import { expect, test } from '../fixtures/accessGate'

const deployedBaseUrl = process.env.DEPLOYED_BASE_URL

function expectSafeApiRedirect(location: string | undefined) {
  if (!location || !deployedBaseUrl) return

  const redirectUrl = new URL(location, deployedBaseUrl)
  const deployedUrl = new URL(deployedBaseUrl)

  expect(redirectUrl.hostname).toBe(deployedUrl.hostname)
  expect(redirectUrl.hostname).not.toMatch(/(?:^|\.)onrender\.com$/i)
}

test('deployment health endpoint returns JSON instead of the SPA', async ({
  request,
}) => {
  test.skip(!process.env.DEPLOYED_BASE_URL, 'set DEPLOYED_BASE_URL to run')

  const response = await request.get('/health')
  const contentType = response.headers()['content-type']
  const responseText = await response.text()

  expect(response.ok()).toBe(true)
  expect(contentType).toContain('application/json')
  expect(responseText).not.toMatch(/<!doctype html|<html/i)

  const body = JSON.parse(responseText) as Record<string, unknown>
  expect(
    Object.prototype.hasOwnProperty.call(body, 'ok') ||
      Object.prototype.hasOwnProperty.call(body, 'status'),
  ).toBe(true)
})

test('admin credentials establish a session for protected API access', async ({
  request,
}) => {
  test.skip(!process.env.DEPLOYED_BASE_URL, 'set DEPLOYED_BASE_URL to run')

  const email = process.env.SMOKE_ADMIN_EMAIL
  const password = process.env.SMOKE_ADMIN_PASSWORD
  test.skip(!email || !password, 'set smoke admin credentials to run')

  const signInResponse = await request.post('/api/auth/sign-in/email', {
    data: { email, password },
    maxRedirects: 0,
  })

  expect(signInResponse.status()).toBe(200)
  expectSafeApiRedirect(signInResponse.headers().location)

  const setCookie = signInResponse.headers()['set-cookie']
  expect(setCookie).toBeTruthy()
  expect(setCookie).toMatch(/session/i)

  const deployedHost = new URL(deployedBaseUrl!).hostname.toLowerCase()
  const cookieDomains = [...setCookie.matchAll(/(?:^|;\s*)domain=([^;,]+)/gi)]
  for (const match of cookieDomains) {
    expect(match[1]?.replace(/^\./, '').toLowerCase()).toBe(deployedHost)
  }

  const usersResponse = await request.get('/api/users', { maxRedirects: 0 })
  expectSafeApiRedirect(usersResponse.headers().location)
  expect(usersResponse.status()).toBe(200)
})

test('API redirects stay on the deployed host', async ({ request }) => {
  test.skip(!process.env.DEPLOYED_BASE_URL, 'set DEPLOYED_BASE_URL to run')

  const response = await request.get('/api/users', { maxRedirects: 0 })
  expectSafeApiRedirect(response.headers().location)
})

test('ticket routes use the SPA fallback', async ({ page }) => {
  test.skip(!process.env.DEPLOYED_BASE_URL, 'set DEPLOYED_BASE_URL to run')

  const response = await page.goto('/tickets')

  expect(response?.status()).toBe(200)
  expect(await response?.text()).toContain('<div id="root"')
})
