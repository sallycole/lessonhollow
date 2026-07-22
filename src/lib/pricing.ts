/**
 * Lesson Hollow credit pricing constants.
 *
 * All payment-related features must reference this file for pricing values.
 * See REQ-BIZ (#179) for the full business model.
 */

// ---------------------------------------------------------------------------
// Credit costs
// ---------------------------------------------------------------------------

/** Cost of one curriculum enrollment in cents ($0.50). */
export const ENROLLMENT_COST_CENTS = 50

// ---------------------------------------------------------------------------
// Top-up
// ---------------------------------------------------------------------------

/** Minimum top-up amount in cents ($10.00). */
export const MINIMUM_TOPUP_CENTS = 1_000

/** Top-up increment in cents ($10.00). Guides choose multiples of this. */
export const TOPUP_INCREMENT_CENTS = 1_000

// ---------------------------------------------------------------------------
// Free tier
// ---------------------------------------------------------------------------

/**
 * The first curriculum enrollment per player is free.
 * No credit card or deposit required until the player's second enrollment.
 */
export const FREE_FIRST_ENROLLMENT = true

// ---------------------------------------------------------------------------
// Reward access
// ---------------------------------------------------------------------------

/**
 * Rewards (fal.ai song generation) require:
 *   1. Guide has a positive credit balance (at least one top-up completed)
 *   2. Guide has a fal.ai API key saved
 *
 * Rewards are NOT available on the initial free enrollment — this
 * incentivizes the first top-up.
 */
export const REWARD_REQUIRES_POSITIVE_BALANCE = true

// ---------------------------------------------------------------------------
// Top-up options
// ---------------------------------------------------------------------------

export const TOPUP_OPTIONS = [
  { amount_cents: 1_000, label: '$10 - 20 enrollments' },
  { amount_cents: 2_000, label: '$20 - 40 enrollments' },
  { amount_cents: 5_000, label: '$50 - 100 enrollments' },
  { amount_cents: 10_000, label: '$100 - 200 enrollments' },
] as const

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Format a cents value as a USD string (e.g. 50 → "$0.50"). */
export function formatCentsUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/** Human-readable enrollment cost. */
export const ENROLLMENT_COST_DISPLAY = formatCentsUSD(ENROLLMENT_COST_CENTS)

/** Human-readable minimum top-up. */
export const MINIMUM_TOPUP_DISPLAY = formatCentsUSD(MINIMUM_TOPUP_CENTS)
