import type { Request, Response, NextFunction } from 'express'
import { processResendEvent, type ResendEvent } from './webhooks.ts'

export async function resendInboundInternal(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const event = req.body as ResendEvent
    if (event.type !== 'email.received') {
      return res.status(200).json({ ignored: true })
    }

    const result = await processResendEvent(event)
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}
