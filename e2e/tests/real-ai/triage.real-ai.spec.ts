import { expect, test } from '@playwright/test'

const WEBHOOK_URL = 'http://localhost:3001/api/webhooks/inbound-email'
const WEBHOOK_SECRET = 'test-webhook-secret'

async function createTicket(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  subject: string,
  body: string,
) {
  const response = await request.post(WEBHOOK_URL, {
    headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
    data: {
      from_email: 'real.ai.validation@example.com',
      from_name: 'Real AI Validation',
      subject,
      body,
      message_id: `<real-ai-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com>`,
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).ticket_id as string
}

async function waitForTicket(request: Parameters<Parameters<typeof test>[1]>[0]['request'], ticketId: string) {
  let ticket: Record<string, unknown> = {}
  await expect.poll(async () => {
    const response = await request.get(`http://localhost:3001/api/tickets/${ticketId}`)
    if (!response.ok()) return 'AI_PROCESSING'
    ticket = await response.json()
    return ticket.status
  }, { timeout: 30000, intervals: [1000] }).not.toBe('AI_PROCESSING')
  return ticket
}

test.describe('real OpenAI triage (opt-in, paid)', () => {
  test('auto-resolves a general voucher instruction question', async ({ request }) => {
    const ticketId = await createTicket(
      request,
      'How do I use a voucher code?',
      'Where can I enter a voucher code during checkout?',
    )
    const ticket = await waitForTicket(request, ticketId)

    expect(ticket.status).toBe('AI_RESOLVED')
    expect(ticket.category).toBe('VOUCHER')
    expect(ticket.is_ai_handled).toBe(true)
  })

  test('escalates an account-specific access problem', async ({ request }) => {
    const ticketId = await createTicket(
      request,
      'Help with my account',
      'Hello, I cannot log in to my account. Please investigate.',
    )
    const ticket = await waitForTicket(request, ticketId)

    expect(ticket.status).toBe('OPEN')
    expect(ticket.category).toBe('ACCOUNT')
    expect(ticket.is_ai_handled).toBe(false)
  })
})
