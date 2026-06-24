import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM = `BizTest Support <${process.env.RESEND_FROM_EMAIL ?? 'support@biztest.help'}>`

export async function sendReplyToCustomer(opts: {
  customerEmail: string
  customerName: string
  subject: string
  body: string
  emailThreadId: string | null
}) {
  const { customerEmail, subject, body, emailThreadId } = opts
  const replySubject = /^re:/i.test(subject) ? subject : `Re: ${subject}`

  const extraHeaders: Record<string, string> = {}
  if (emailThreadId) {
    extraHeaders['In-Reply-To'] = emailThreadId
    extraHeaders['References'] = emailThreadId
  }

  await resend.emails.send({
    from: FROM,
    to: customerEmail,
    subject: replySubject,
    text: body,
    headers: extraHeaders,
  })
}
