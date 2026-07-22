import { describe, it, expect } from 'vitest'
import { detectTimezone, timezones } from '../timezones'

describe('detectTimezone', () => {
  it('detects US Central time (UTC-6)', () => {
    // Browser getTimezoneOffset() returns 360 for UTC-6
    expect(detectTimezone(360)).toBe('America/Chicago')
  })

  it('detects US Eastern time (UTC-5)', () => {
    expect(detectTimezone(300)).toBe('America/New_York')
  })

  it('detects US Pacific time (UTC-8)', () => {
    expect(detectTimezone(480)).toBe('America/Los_Angeles')
  })

  it('detects GMT (UTC+0)', () => {
    expect(detectTimezone(0)).toBe('Europe/London')
  })

  it('detects Japan Standard Time (UTC+9)', () => {
    // Browser returns -540 for UTC+9
    expect(detectTimezone(-540)).toBe('Asia/Tokyo')
  })

  it('picks closest timezone for non-exact offsets', () => {
    // India is UTC+5:30 (offset 330), browser returns -330
    expect(detectTimezone(-330)).toBe('Asia/Kolkata')
  })

  it('handles extreme positive offset', () => {
    // UTC+12
    expect(detectTimezone(-720)).toBe('Pacific/Auckland')
  })

  it('handles extreme negative offset', () => {
    // UTC-12
    expect(detectTimezone(720)).toBe('Etc/GMT+12')
  })
})

describe('timezones list', () => {
  it('is sorted by UTC offset', () => {
    for (let i = 1; i < timezones.length; i++) {
      expect(timezones[i].offset).toBeGreaterThanOrEqual(timezones[i - 1].offset)
    }
  })

  it('has unique values', () => {
    const values = timezones.map((tz) => tz.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('labels include UTC offset', () => {
    for (const tz of timezones) {
      expect(tz.label).toMatch(/UTC[+-]/)
    }
  })
})
