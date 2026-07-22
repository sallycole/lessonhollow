/**
 * Credit system helpers.
 *
 * All credit-related features import from this module for balance checks,
 * enrollment gating, and reward access control.
 *
 * See REQ-PAYMENTS-DB (#180) and REQ-BIZ (#179).
 */

import { db } from './db'
import { ENROLLMENT_COST_CENTS } from './pricing'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditAccount {
  id: string
  user_id: string
  balance_cents: number
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Get or create a credit account for the given guide user.
 * Returns the credit account row.
 */
export async function getCreditAccount(userId: string): Promise<CreditAccount> {
  const { data, error } = await db.getCreditAccount(userId)

  if (data) return data as CreditAccount

  // Account may not exist yet (e.g. users created before migration).
  // Create one on-demand.
  if (error?.code === 'PGRST116') {
    const { data: created, error: createErr } = await db.createCreditAccount(userId)
    if (createErr) throw new Error(`Failed to create credit account: ${createErr.message}`)
    return created as CreditAccount
  }

  throw new Error(`Failed to read credit account: ${error?.message ?? 'unknown'}`)
}

/**
 * Returns true if the guide has ever made a deposit (top-up).
 */
export async function hasMadeDeposit(userId: string): Promise<boolean> {
  const { count } = await db.hasDepositTransaction(userId)
  return (count ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Enrollment credit gate
// ---------------------------------------------------------------------------

/**
 * Check whether the guide has sufficient credit for a new enrollment.
 *
 * The first enrollment per player is free. After that, credits are deducted
 * from the guide's account.
 */
export async function assertEnrollmentCredit(userId: string, playerId: string | null): Promise<
  | { allowed: true; isFreeEnrollment: boolean }
  | { allowed: false; reason: string }
> {
  // If no player context yet, skip the free-enrollment check and just
  // verify the guide has some balance. The action will enforce the real check.
  if (playerId) {
    const { data: player } = await db.getPlayerById(playerId)
    if (player && !player.free_enrollment_used) {
      return { allowed: true, isFreeEnrollment: true }
    }
  }

  const acct = await getCreditAccount(userId)

  if (acct.balance_cents >= ENROLLMENT_COST_CENTS) {
    return { allowed: true, isFreeEnrollment: false }
  }

  return {
    allowed: false,
    reason: "You're out of credits. Top up to enroll more players.",
  }
}

/**
 * Spend enrollment credit atomically via the SQL function.
 * Throws on INSUFFICIENT_CREDITS or NO_CREDIT_ACCOUNT.
 */
export async function spendEnrollmentCredit(
  userId: string,
  enrollmentId: string,
  description: string
): Promise<void> {
  const { error } = await db.spendEnrollmentCredit(userId, enrollmentId, description)

  if (error) {
    if (error.message?.includes('INSUFFICIENT_CREDITS')) {
      throw new Error('INSUFFICIENT_CREDITS')
    }
    if (error.message?.includes('NO_CREDIT_ACCOUNT')) {
      throw new Error('NO_CREDIT_ACCOUNT')
    }
    throw new Error(`Failed to spend enrollment credit: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Reward access gate
// ---------------------------------------------------------------------------

/**
 * Check whether the guide has access to the reward feature.
 *
 * Requires:
 *   1. At least one deposit (top-up) in history — free enrollment alone is not enough
 *   2. A fal.ai API key (checked separately — this function only checks credits)
 */
export async function assertRewardAccess(userId: string): Promise<
  | { allowed: true }
  | { allowed: false; reason: 'REWARD_GATED' | 'NO_DEPOSIT' }
> {
  const deposited = await hasMadeDeposit(userId)

  if (!deposited) {
    return {
      allowed: false,
      reason: 'REWARD_GATED',
    }
  }

  return { allowed: true }
}
