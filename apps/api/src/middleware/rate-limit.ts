import type { Request, Response, NextFunction } from 'express'

type RateLimitOptions = {
  windowMs: number
  maxRequests: number
  keyPrefix: string
  message: string
  code: string
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

export function createRateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, RateLimitEntry>()

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const now = Date.now()
    const key = `${options.keyPrefix}:${req.ip}`
    const current = buckets.get(key)

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      })
      next()
      return
    }

    current.count += 1

    if (current.count > options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))

      res.setHeader('Retry-After', String(retryAfterSeconds))
      res.status(429).json({
        message: options.message,
        code: options.code,
      })
      return
    }

    next()
  }
}