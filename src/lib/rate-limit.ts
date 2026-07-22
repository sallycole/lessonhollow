import { NextResponse } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  maxAttempts: number = 3,
  windowMs: number = 60_000
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, retryAfterMs: 0 }
}

/**
 * Check rate limit for an authenticated API endpoint.
 * Returns a 429 NextResponse if the limit is exceeded, or null if allowed.
 */
export function checkApiRateLimit(
  userId: string,
  endpoint: string,
  maxAttempts: number = 100,
  windowMs: number = 60_000
): NextResponse | null {
  const key = `api:${endpoint}:${userId}`
  const { allowed, retryAfterMs } = checkRateLimit(key, maxAttempts, windowMs)

  if (!allowed) {
    console.warn(`Rate limit exceeded: ${endpoint} by user ${userId}`)
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
      }
    )
  }

  return null
}
