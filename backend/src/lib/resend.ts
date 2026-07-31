import { Resend } from 'resend'

if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is required in production')
}

let resend: Resend | undefined

export function getResendClient(): Resend {
  resend ??= new Resend(process.env.RESEND_API_KEY!)
  return resend
}
