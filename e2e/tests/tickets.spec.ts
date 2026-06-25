/**
 * E2E tests for the inbound email webhook and ticket UI.
 *
 * Rule: only test what cannot be covered by component unit tests —
 * real API/backend integration, cross-service flows, actual mutations,
 * and backend-enforced authorization.
 *
 * Coverage:
 *  Webhook API (no browser) — all tests here; this is pure API integration
 *
 *  Tickets list — integration only:
 *   - Ticket created via webhook appears in admin's list (real pipeline)
 *   - Assign modal shows real agents loaded from the database
 *   - Assigning via modal fires real PATCH and updates the row in-place
 *   - Viewing assigned agent modal shows real agent data
 *   - Re-assign transitions modal to agent picker (real data flow)
 *   - Clicking subject link navigates to the correct real ticket URL
 *   - Unassigned ticket hidden from agent (backend role filter enforced)
 *   - Assigned ticket visible to agent after real assignment
 *   - Search narrows results against the real database
 *
 *  Ticket detail — integration only:
 *   - Assigning agent via modal fires real PATCH and updates the button label
 *   - Saving status change fires real PATCH and updates the header badge
 *   - Agent reply fires real POST and the message appears in the thread
 */

import { test as apiTest, expect as apiExpect, type Page } from '@playwright/test'
import { test, expect } from './fixtures/auth'

const WEBHOOK_URL = 'http://localhost:3001/api/webhooks/inbound-email'
const WEBHOOK_SECRET = 'test-webhook-secret'

function uniqueMessageId() {
  return `<ticket-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com>`
}

async function createTicketViaWebhook(
  request: Parameters<Parameters<typeof apiTest>[1]>[0]['request'],
  overrides: Record<string, string> = {},
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

/** Returns the test agent's ID via the admin auth context. */
async function getTestAgentId(adminPage: Page): Promise<string> {
  const res = await adminPage.request.get('http://localhost:3001/api/users/agents')
  const agents: Array<{ id: string; email: string }> = await res.json()
  const agent = agents.find(a => a.email === 'agent@test.com')
  if (!agent) throw new Error('Test agent (agent@test.com) not found in /api/users/agents')
  return agent.id
}

/** Assigns a ticket to a user via the admin auth context. */
async function assignTicket(adminPage: Page, ticketId: string, agentId: string | null) {
  await adminPage.request.patch(`http://localhost:3001/api/tickets/${ticketId}`, {
    data: { assigned_to_id: agentId },
  })
}

// ---------------------------------------------------------------------------
// Webhook API — pure backend integration, cannot be unit tested
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

  apiTest('appends to the thread when only References (not in_reply_to) holds the root', async ({ request }) => {
    // Regression: after an agent replies, the customer's next reply points In-Reply-To at
    // the agent's message (unknown to us). The original thread root only survives in the
    // References chain, so matching must consider it or a duplicate ticket is created.
    const { res: firstRes, messageId: rootId } = await createTicketViaWebhook(request)
    const { ticket_id: originalId } = await firstRes.json()

    const agentReplyId = uniqueMessageId()
    const replyRes = await request.post(WEBHOOK_URL, {
      headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
      data: {
        from_email: 'alice@example.com',
        subject: 'Re: Help with my account',
        body: 'Replying to your answer.',
        message_id: uniqueMessageId(),
        in_reply_to: agentReplyId,
        references: `${rootId} ${agentReplyId}`,
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
// Tickets list — integration tests only
// ---------------------------------------------------------------------------

test.describe('tickets list', () => {
  test('ticket created via webhook appears in the admin list (real pipeline)', async ({
    adminPage: page,
    request,
  }) => {
    const subject = `E2E Pipeline ${Date.now()}`
    await createTicketViaWebhook(request, { subject })

    await page.goto('/tickets')
    await page.getByPlaceholder('Search tickets…').fill(subject)
    await expect(page.getByRole('link', { name: subject })).toBeVisible()
  })

  test('assign modal shows real agents loaded from the database', async ({
    adminPage: page,
    request,
  }) => {
    const subject = `E2E Agent List ${Date.now()}`
    await createTicketViaWebhook(request, { subject })

    await page.goto('/tickets')
    await page.getByPlaceholder('Search tickets…').fill(subject)
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: subject }) })
    await row.getByRole('button', { name: 'Assign' }).click()

    await expect(page.getByRole('heading', { name: 'Assign Agent' })).toBeVisible()
    await expect(page.getByText('agent@test.com')).toBeVisible()
  })

  test('assigning via modal fires a real PATCH and updates the row in-place', async ({
    adminPage: page,
    request,
  }) => {
    const subject = `E2E Assign PATCH ${Date.now()}`
    await createTicketViaWebhook(request, { subject })

    await page.goto('/tickets')
    await page.getByPlaceholder('Search tickets…').fill(subject)
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: subject }) })
    await row.getByRole('button', { name: 'Assign' }).click()
    await page.locator('button').filter({ hasText: 'agent@test.com' }).click()

    // Row updated in-place without re-sort — Assign gone, 👤 present
    await expect(row.getByRole('button', { name: 'Assign' })).not.toBeVisible()
    await expect(row.getByRole('button', { name: '👤' })).toBeVisible()
  })

  test('viewing assigned agent modal shows real agent data from the database', async ({
    adminPage: page,
    request,
  }) => {
    const subject = `E2E View Agent ${Date.now()}`
    const { res } = await createTicketViaWebhook(request, { subject })
    const { ticket_id } = await res.json()
    const agentId = await getTestAgentId(page)
    await assignTicket(page, ticket_id, agentId)

    await page.goto('/tickets')
    await page.getByPlaceholder('Search tickets…').fill(subject)
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: subject }) })
    await row.getByRole('button', { name: '👤' }).click()

    await expect(page.getByRole('heading', { name: 'Assigned Agent' })).toBeVisible()
    await expect(page.getByText('agent@test.com')).toBeVisible()
  })

  test('"Re-assign" transitions view modal to agent picker', async ({
    adminPage: page,
    request,
  }) => {
    const subject = `E2E Re-assign ${Date.now()}`
    const { res } = await createTicketViaWebhook(request, { subject })
    const { ticket_id } = await res.json()
    const agentId = await getTestAgentId(page)
    await assignTicket(page, ticket_id, agentId)

    await page.goto('/tickets')
    await page.getByPlaceholder('Search tickets…').fill(subject)
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: subject }) })
    await row.getByRole('button', { name: '👤' }).click()
    await page.getByRole('button', { name: 'Re-assign' }).click()

    await expect(page.getByRole('heading', { name: 'Assign Agent' })).toBeVisible()
  })

  test('clicking subject navigates to the correct ticket URL', async ({
    adminPage: page,
    request,
  }) => {
    const subject = `E2E Nav ${Date.now()}`
    const { res } = await createTicketViaWebhook(request, { subject })
    const { ticket_id } = await res.json()

    await page.goto('/tickets')
    await page.getByPlaceholder('Search tickets…').fill(subject)
    await page.getByRole('link', { name: subject }).click()
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticket_id}`))
  })

  test('unassigned ticket is hidden from agent (backend role filter)', async ({
    agentPage: page,
    request,
  }) => {
    const subject = `E2E Hidden ${Date.now()}`
    await createTicketViaWebhook(request, { subject })

    await page.goto('/tickets')
    await page.getByPlaceholder('Search tickets…').fill(subject)
    await page.waitForTimeout(500) // allow debounce + fetch
    await expect(page.getByRole('link', { name: subject })).not.toBeVisible()
  })

  test('assigned ticket becomes visible to agent after real assignment', async ({
    adminPage,
    agentPage: page,
    request,
  }) => {
    const subject = `E2E Visible ${Date.now()}`
    const { res } = await createTicketViaWebhook(request, { subject })
    const { ticket_id } = await res.json()
    const agentId = await getTestAgentId(adminPage)
    await assignTicket(adminPage, ticket_id, agentId)

    await page.goto('/tickets')
    await page.getByPlaceholder('Search tickets…').fill(subject)
    await expect(page.getByRole('link', { name: subject })).toBeVisible()
  })

  test('search filters results against the real database', async ({
    adminPage: page,
    request,
  }) => {
    const subject = `E2E SearchUnique ${Date.now()}`
    await createTicketViaWebhook(request, { subject })

    await page.goto('/tickets')
    await page.getByPlaceholder('Search tickets…').fill(subject)
    await expect(page.getByRole('link', { name: subject })).toBeVisible()
    await expect(page.getByText(/showing 1.+of 1/i)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Ticket detail — integration tests only
// ---------------------------------------------------------------------------

test.describe('ticket detail', () => {
  test('assigning agent fires real PATCH and updates the button label', async ({
    adminPage: page,
    request,
  }) => {
    const { res } = await createTicketViaWebhook(request)
    const { ticket_id } = await res.json()

    await page.goto(`/tickets/${ticket_id}`)
    await page.getByRole('button', { name: 'Unassigned' }).click()
    await page.locator('button').filter({ hasText: 'agent@test.com' }).click()

    await expect(page.getByRole('heading', { name: 'Assign Agent' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Unassigned' })).not.toBeVisible()
  })

  test('saving status change fires real PATCH and updates the header badge', async ({
    adminPage: page,
    request,
  }) => {
    const { res } = await createTicketViaWebhook(request)
    const { ticket_id } = await res.json()

    await page.goto(`/tickets/${ticket_id}`)
    await page.getByLabel('Status').selectOption('IN_PROGRESS')
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await expect(page.getByText('In Progress').first()).toBeVisible()
  })

  test('agent reply fires real POST and the message appears in the thread', async ({
    adminPage,
    agentPage: page,
    request,
  }) => {
    const { res } = await createTicketViaWebhook(request)
    const { ticket_id } = await res.json()
    const agentId = await getTestAgentId(adminPage)
    await assignTicket(adminPage, ticket_id, agentId)

    await page.goto(`/tickets/${ticket_id}`)
    const replyText = `Real reply ${Date.now()}`
    await page.getByPlaceholder('Write your reply…').fill(replyText)
    await page.getByRole('button', { name: 'Send Reply' }).click()

    await expect(page.getByText(replyText)).toBeVisible()
    await expect(page.getByPlaceholder('Write your reply…')).toHaveValue('')
  })
})
