import { test as base, type BrowserContext } from '@playwright/test'

export const ACCESS_KEY_STORAGE_KEY = 'dailyplate.accessKey'
export const TEST_ACCESS_KEY = 'E2E-TEST-KEY'

const TEST_PROJECT_ID = '00000000-0000-4000-8000-000000000000'

export async function bypassAccessGate(
  context: BrowserContext,
): Promise<void> {
  await context.route('**/functions/v1/verify-access-key', async route => {
    const method = route.request().method()

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      })
      return
    }

    if (method === 'POST') {
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ valid: true, project_id: TEST_PROJECT_ID }),
      })
      return
    }

    await route.fallback()
  })

  await context.addInitScript(
    ({ storageKey, accessKey }) => {
      try {
        localStorage.setItem(storageKey, accessKey)
      } catch {
        // The application will show the gate if storage is unavailable.
      }
    },
    { storageKey: ACCESS_KEY_STORAGE_KEY, accessKey: TEST_ACCESS_KEY },
  )
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await bypassAccessGate(context)
    await use(context)
  },
})

export { expect } from '@playwright/test'
