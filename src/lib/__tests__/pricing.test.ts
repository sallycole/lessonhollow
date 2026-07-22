import { describe, it, expect } from 'vitest'
import {
  ENROLLMENT_COST_CENTS,
  MINIMUM_TOPUP_CENTS,
  TOPUP_INCREMENT_CENTS,
  TOPUP_OPTIONS,
  ENROLLMENT_COST_DISPLAY,
  MINIMUM_TOPUP_DISPLAY,
  formatCentsUSD,
} from '../pricing'

describe('pricing constants', () => {
  it('enrollment costs $0.50', () => {
    expect(ENROLLMENT_COST_CENTS).toBe(50)
  })

  it('minimum top-up is $10.00', () => {
    expect(MINIMUM_TOPUP_CENTS).toBe(1_000)
  })

  it('top-up increment is $10.00', () => {
    expect(TOPUP_INCREMENT_CENTS).toBe(1_000)
  })
})

describe('formatCentsUSD', () => {
  it('formats 50 cents as $0.50', () => {
    expect(formatCentsUSD(50)).toBe('$0.50')
  })

  it('formats 1000 cents as $10.00', () => {
    expect(formatCentsUSD(1_000)).toBe('$10.00')
  })

  it('formats 0 cents as $0.00', () => {
    expect(formatCentsUSD(0)).toBe('$0.00')
  })

  it('formats 5000 cents as $50.00', () => {
    expect(formatCentsUSD(5_000)).toBe('$50.00')
  })
})

describe('TOPUP_OPTIONS', () => {
  it('has four options', () => {
    expect(TOPUP_OPTIONS).toHaveLength(4)
  })

  it('all amounts are multiples of TOPUP_INCREMENT_CENTS', () => {
    for (const opt of TOPUP_OPTIONS) {
      expect(opt.amount_cents % TOPUP_INCREMENT_CENTS).toBe(0)
    }
  })

  it('all amounts meet the minimum', () => {
    for (const opt of TOPUP_OPTIONS) {
      expect(opt.amount_cents).toBeGreaterThanOrEqual(MINIMUM_TOPUP_CENTS)
    }
  })

  it('labels show correct enrollment counts at $0.50 each', () => {
    for (const opt of TOPUP_OPTIONS) {
      const expectedEnrollments = opt.amount_cents / ENROLLMENT_COST_CENTS
      expect(opt.label).toContain(`${expectedEnrollments} enrollments`)
    }
  })
})

describe('display constants', () => {
  it('enrollment cost display is $0.50', () => {
    expect(ENROLLMENT_COST_DISPLAY).toBe('$0.50')
  })

  it('minimum top-up display is $10.00', () => {
    expect(MINIMUM_TOPUP_DISPLAY).toBe('$10.00')
  })
})
