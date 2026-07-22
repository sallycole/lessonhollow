import { describe, it, expect } from 'vitest'
import {
  resolveTimeZone,
  dateKeyInTimeZone,
  todayInTimeZone,
  addDaysToDateKey,
  daysBetweenKeys,
} from '../date-tz'

describe('resolveTimeZone', () => {
  it('passes through a valid IANA zone', () => {
    expect(resolveTimeZone('America/New_York')).toBe('America/New_York')
  })
  it('falls back to the app default for null/empty/invalid', () => {
    expect(resolveTimeZone(null)).toBe('America/Chicago')
    expect(resolveTimeZone('')).toBe('America/Chicago')
    expect(resolveTimeZone('Not/AZone')).toBe('America/Chicago')
  })
})

describe('dateKeyInTimeZone', () => {
  it('buckets an evening-local instant on the local day, not the UTC day', () => {
    // 7:31 PM Central on Jul 15 is 00:31 UTC on Jul 16 — the original bug.
    const instant = '2026-07-16T00:31:00.000Z'
    expect(dateKeyInTimeZone(instant, 'America/Chicago')).toBe('2026-07-15')
    // Same instant in UTC really is the 16th.
    expect(dateKeyInTimeZone(instant, 'UTC')).toBe('2026-07-16')
  })
  it('accepts a Date as well as an ISO string', () => {
    expect(dateKeyInTimeZone(new Date('2026-07-15T12:00:00Z'), 'America/Chicago')).toBe('2026-07-15')
  })
})

describe('todayInTimeZone', () => {
  it('uses the injected instant', () => {
    const now = new Date('2026-07-16T00:31:00.000Z')
    expect(todayInTimeZone('America/Chicago', now)).toBe('2026-07-15')
    expect(todayInTimeZone('UTC', now)).toBe('2026-07-16')
  })
})

describe('addDaysToDateKey', () => {
  it('crosses month and year boundaries', () => {
    expect(addDaysToDateKey('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDaysToDateKey('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('is DST-safe (pure calendar math)', () => {
    // US fall-back is Nov 2 2025; spring-forward is Mar 8 2026.
    expect(addDaysToDateKey('2025-11-02', -1)).toBe('2025-11-01')
    expect(addDaysToDateKey('2026-03-08', 1)).toBe('2026-03-09')
  })
})

describe('daysBetweenKeys', () => {
  it('counts whole calendar days', () => {
    expect(daysBetweenKeys('2026-07-15', '2026-07-16')).toBe(1)
    expect(daysBetweenKeys('2026-07-16', '2026-07-15')).toBe(-1)
    expect(daysBetweenKeys('2026-07-15', '2026-07-15')).toBe(0)
  })
  it('is DST-safe across spring-forward', () => {
    expect(daysBetweenKeys('2026-03-08', '2026-03-09')).toBe(1)
  })
})
