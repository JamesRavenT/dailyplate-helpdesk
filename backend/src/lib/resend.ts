import { Resend } from 'resend'
import { isEmailDeliveryEnabled } from './deployment-flags.ts'

if (
  isEmailDeliveryEnabled(process.env.NODE_ENV, process.env.EMAIL_DELIVERY_ENABLED) &&
  !process.env.RESEND_API_KEY
) {
  throw new Error(
    'RESEND_API_KEY is required when email delivery is enabled; set EMAIL_DELIVERY_ENABLED=false to disable delivery',
  )
}

let resend: Resend | undefined

export function getResendClient(): Resend {
  resend ??= new Resend(process.env.RESEND_API_KEY!)
  return resend
}
