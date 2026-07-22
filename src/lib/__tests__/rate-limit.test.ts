import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkRateLimit, checkApiRateLimit } from '../rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests under the limit', () => {
    const key = 'test-under-limit'
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(key, 5, 60_000)
      expect(result.allowed).toBe(true)
      expect(result.retryAfterMs).toBe(0)
    }
  })

  it('blocks requests at the limit', () => {
    const key = 'test-at-limit'
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 60_000)
    }
    const result = checkRateLimit(key, 3, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000)
  })

  it('resets after window expires', () => {
    const key = 'test-window-reset'
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 60_000)
    }
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(false)

    vi.advanceTimersByTime(60_001)

    const result = checkRateLimit(key, 3, 60_000)
    expect(result.allowed).toBe(true)
  })

  it('tracks different keys independently', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit('key-a', 3, 60_000)
    }
    expect(checkRateLimit('key-a', 3, 60_000).allowed).toBe(false)
    expect(checkRateLimit('key-b', 3, 60_000).allowed).toBe(true)
  })

  it('returns decreasing retryAfterMs as window progresses', () => {
    const key = 'test-retry-after'
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 60_000)
    }

    const first = checkRateLimit(key, 3, 60_000)
    expect(first.allowed).toBe(false)

    vi.advanceTimersByTime(30_000)

    const second = checkRateLimit(key, 3, 60_000)
    expect(second.allowed).toBe(false)
    expect(second.retryAfterMs).toBeLessThan(first.retryAfterMs)
  })
})

describe('checkApiRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when under the limit', () => {
    const result = checkApiRateLimit('user-1', 'test-endpoint', 100, 60_000)
    expect(result).toBeNull()
  })

  it('returns 429 response with Retry-After when limit exceeded', () => {
    for (let i = 0; i < 5; i++) {
      checkApiRateLimit('user-2', 'feedback', 5, 3600_000)
    }
    const result = checkApiRateLimit('user-2', 'feedback', 5, 3600_000)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)
    expect(result!.headers.get('Retry-After')).toBeTruthy()
    const retryAfter = parseInt(result!.headers.get('Retry-After')!, 10)
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(3600)
  })

  it('scopes limits per user and endpoint independently', () => {
    for (let i = 0; i < 5; i++) {
      checkApiRateLimit('user-3', 'endpointA', 5, 60_000)
    }
    // Same user, different endpoint — not limited
    expect(checkApiRateLimit('user-3', 'endpointB', 5, 60_000)).toBeNull()
    // Different user, same endpoint — not limited
    expect(checkApiRateLimit('user-4', 'endpointA', 5, 60_000)).toBeNull()
    // Same user, same endpoint — limited
    expect(checkApiRateLimit('user-3', 'endpointA', 5, 60_000)).not.toBeNull()
  })
})
