import { test, expect } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

const testEnv = dotenv.parse(
  fs.readFileSync(path.resolve(__dirname, '../../backend/.env.test'), 'utf8'),
)
const INTERNAL_API_TOKEN = testEnv.INTERNAL_API_TOKEN
const INTERNAL_URL = 'http://localhost:3001/api/internal/resend-inbound'
const ignoredEvent = { type: 'email.other' }

test.describe('internal API authentication', () => {
  test('rejects requests without an internal token', async ({ request }) => {
    const response = await request.post(INTERNAL_URL, { data: ignoredEvent })

    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  test('rejects requests with the wrong internal token', async ({ request }) => {
    const response = await request.post(INTERNAL_URL, {
      headers: { 'X-Internal-Token': 'wrong-token' },
      data: ignoredEvent,
    })

    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  test('accepts a valid token and ignores unrelated Resend events', async ({ request }) => {
    const response = await request.post(INTERNAL_URL, {
      headers: { 'X-Internal-Token': INTERNAL_API_TOKEN },
      data: ignoredEvent,
    })

    expect(response.status()).toBe(200)
    await expect(response.json()).resolves.toEqual({ ignored: true })
  })
})
