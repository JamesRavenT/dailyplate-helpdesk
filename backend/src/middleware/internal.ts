import { timingSafeEqual } from 'crypto'
import type { Request, Response, NextFunction } from 'express'

if (process.env.NODE_ENV === 'production' && !process.env.INTERNAL_API_TOKEN) {
  throw new Error('INTERNAL_API_TOKEN is required in production')
}

export function requireInternalToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const provided = req.get('x-internal-token')
  const expected = process.env.INTERNAL_API_TOKEN

  if (
    !provided ||
    !expected ||
    Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  next()
}
