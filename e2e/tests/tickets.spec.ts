/**
 * End-to-end tests for the inbound email webhook and ticket UI.
 *
 * Coverage:
 *  Webhook API (no browser):
 *   - Creates a ticket from a valid email payload
 *   - Appends a message when in_reply_to matches an existing thread
 *   - Falls through to new ticket when in_reply_to matches nothing
 *   - Rejects requests with a wrong or missing webhook secret
 *   - Rejects payloads missing required fields or with an invalid email
 *
 *  Tickets list UI (agentPage):
 *   - "Tickets" link visible in navbar for authenticated users
 *   - /tickets page renders heading and table/empty state
 *   - Ticket created via webhook appears in the table
 *   - Clicking a subject link navigates to the detail page
 *
 *  Ticket detail UI (agentPage):
 *   - Subject, customer email, and message body are visible
 *   - Status can be updated via the dropdown form
 *   - "Back to Tickets" returns to the list
 */

import { test as apiTest, expect as apiExpect } from '@playwright/test'
import { test, expect } from './fixtures/auth'

const WEBHOOK_URL = 'http://localhost:3001/api/webhooks/inbound-email'
const WEBHOOK_SECRET = 'test-webhook-secret'

function uniqueMessageId() {
  return `<ticket-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com>`
}

async function createTicketViaWebhook(
  request: Parameters<Parameters<typeof apiTest>[1]>[0]['request'],
  overrides: Record<string, string> = {}
) {
  const messageId = uniqueMessageId()
  const res = await request.post(WEBHOOK_URL, {
    headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
    data: {
      from_email: 'alice@example.com',
      from_name: 'Alice Smith',
      subject: 'Help with my account',
      body: 'Hello, I cannot log in.',
      message_id: messageId,
      ...overrides,
    },
  })
  return { res, messageId }
}

// ---------------------------------------------------------------------------
// Webhook API tests
// ---------------------------------------------------------------------------

apiTest.describe('inbound email webhook', () => {
  apiTest('creates a ticket from a valid payload', async ({ request }) => {
    const { res } = await createTicketViaWebhook(request)

    apiExpect(res.status()).toBe(201)
    const body = await res.json()
    apiExpect(body.action).toBe('ticket_created')
    apiExpect(typeof body.ticket_id).toBe('string')
  })

  apiTest('appends a message when in_reply_to matches an existing thread', async ({ request }) => {
    const { res: firstRes, messageId } = await createTicketViaWebhook(request)
    const { ticket_id: originalId } = await firstRes.json()

    const replyRes = await request.post(WEBHOOK_URL, {
      headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
      data: {
        from_email: 'alice@example.com',
        subject: 'Re: Help with my account',
        body: 'Still waiting, thanks.',
        message_id: uniqueMessageId(),
        in_reply_to: messageId,
      },
    })

    apiExpect(replyRes.status()).toBe(200)
    const body = await replyRes.json()
    apiExpect(body.action).toBe('message_added')
    apiExpect(body.ticket_id).toBe(originalId)
  })

  apiTest('creates a new ticket when in_reply_to matches nothing', async ({ request }) => {
    const res = await request.post(WEBHOOK_URL, {
      headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
      data: {
        from_email: 'bob@example.com',
        subject: 'New issue',
        body: 'Please help.',
        message_id: uniqueMessageId(),
        in_reply_to: '<nonexistent-thread@test.com>',
      },
    })

    apiExpect(res.status()).toBe(201)
    const body = await res.json()
    apiExpect(body.action).toBe('ticket_created')
  })

  apiTest('rejects a request with the wrong secret', async ({ request }) => {
    const res = await request.post(WEBHOOK_URL, {
      headers: { 'X-Webhook-Secret': 'wrong-secret' },
      data: { from_email: 'x@x.com', subject: 'test', body: 'test' },
    })
    apiExpect(res.status()).toBe(401)
  })

  apiTest('rejects a request with no secret header', async ({ request }) => {
    const res = await request.post(WEBHOOK_URL, {
      data: { from_email: 'x@x.com', subject: 'test', body: 'test' },
    })
    apiExpect(res.status()).toBe(401)
  })

  apiTest('rejects a payload missing subject', async ({ request }) => {
    const res = await request.post(WEBHOOK_URL, {
      headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
      data: { from_email: 'x@x.com', body: 'test' },
    })
    apiExpect(res.status()).toBe(400)
  })

  apiTest('rejects a payload missing body', async ({ request }) => {
    const res = await request.post(WEBHOOK_URL, {
      headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
      data: { from_email: 'x@x.com', subject: 'test' },
    })
    apiExpect(res.status()).toBe(400)
  })

  apiTest('rejects an invalid from_email', async ({ request }) => {
    const res = await request.post(WEBHOOK_URL, {
      headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
      data: { from_email: 'not-an-email', subject: 'test', body: 'test' },
    })
    apiExpect(res.status()).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Tickets list UI tests
// ---------------------------------------------------------------------------

test.describe('tickets list', () => {
  test('authenticated user sees Tickets link in navbar', async ({ agentPage: page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Tickets' })).toBeVisible()
  })

  test('/tickets page renders heading and table structure', async ({ agentPage: page }) => {
    await page.goto('/tickets')
    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible()
    const hasTable = await page.getByRole('columnheader', { name: 'Subject' }).isVisible()
    const hasEmptyState = await page.getByText(/no tickets yet/i).isVisible()
    expect(hasTable || hasEmptyState).toBeTruthy()
  })

  test('ticket created via webhook appears in the list', async ({ agentPage: page, request }) => {
    const subject = `E2E Subject ${Date.now()}`
    await createTicketViaWebhook(request, { subject })

    await page.goto('/tickets')
    await expect(page.getByRole('link', { name: subject })).toBeVisible()
  })

  test('clicking a subject link navigates to the ticket detail page', async ({ agentPage: page, request }) => {
    const subject = `E2E Nav ${Date.now()}`
    const { res } = await createTicketViaWebhook(request, { subject })
    const { ticket_id } = await res.json()

    await page.goto('/tickets')
    await page.getByRole('link', { name: subject }).click()
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticket_id}`))
  })
})

// ---------------------------------------------------------------------------
// Ticket detail UI tests
// ---------------------------------------------------------------------------

test.describe('ticket detail', () => {
  test('shows subject, customer email, and message body', async ({ agentPage: page, request }) => {
    const subject = `E2E Detail ${Date.now()}`
    const { res } = await createTicketViaWebhook(request, {
      subject,
      from_email: 'alice@example.com',
      body: 'Hello, I cannot log in.',
    })
    const { ticket_id } = await res.json()

    await page.goto(`/tickets/${ticket_id}`)
    await expect(page.getByRole('heading', { name: subject })).toBeVisible()
    await expect(page.getByText('alice@example.com')).toBeVisible()
    await expect(page.getByText('Hello, I cannot log in.')).toBeVisible()
  })

  test('status can be updated via the dropdown form', async ({ agentPage: page, request }) => {
    const { res } = await createTicketViaWebhook(request)
    const { ticket_id } = await res.json()

    await page.goto(`/tickets/${ticket_id}`)
    await page.getByLabel('Status').selectOption('IN_PROGRESS')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText('In Progress').first()).toBeVisible()
  })

  test('Back to Tickets link returns to the list', async ({ agentPage: page, request }) => {
    const { res } = await createTicketViaWebhook(request)
    const { ticket_id } = await res.json()

    await page.goto(`/tickets/${ticket_id}`)
    await page.getByRole('button', { name: /back to tickets/i }).click()
    await expect(page).toHaveURL('/tickets')
  })
})
