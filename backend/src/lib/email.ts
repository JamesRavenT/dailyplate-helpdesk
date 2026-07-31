import { getResendClient } from './resend.ts'

const FROM = `DailyPlate Support <${process.env.RESEND_FROM_EMAIL ?? 'support@dailyplate.help'}>`

export async function sendReplyToCustomer(opts: {
  ticketId: string
  messageId: string
  replyType: 'agent' | 'ai'
  customerEmail: string
  customerName: string
  subject: string
  body: string
  emailThreadId: string | null
}) {
  const { ticketId, messageId, replyType, customerEmail, subject, body, emailThreadId } = opts
  const replySubject = /^re:/i.test(subject) ? subject : `Re: ${subject}`

  const extraHeaders: Record<string, string> = {}
  if (emailThreadId) {
    extraHeaders['In-Reply-To'] = emailThreadId
    extraHeaders['References'] = emailThreadId
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[email] dev mode — skipping send to ${customerEmail} (${replySubject})`)
    return
  }

  const { data, error } = await getResendClient().emails.send(
    {
      from: FROM,
      to: customerEmail,
      subject: replySubject,
      text: body,
      headers: extraHeaders,
    },
    { idempotencyKey: `ticket-reply/${ticketId}/${replyType}/${messageId}` },
  )

  if (error) {
    console.error(
      `[email] send failed: recipient=${customerEmail} subject=${replySubject} ${error.name}: ${error.message}`,
    )
    throw new Error(error.message)
  }

  void data
}
