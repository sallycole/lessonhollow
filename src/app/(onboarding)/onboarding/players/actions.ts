'use server'

import { createClient } from '@/lib/supabase/server'
import { createPlayerForGuide, type CreatePlayerResult } from '@/lib/onboarding/player-actions'

export type AddLearnersResult = {
  error?: string
  results?: { index: number; username: string; error?: string; playerId?: string }[]
}

/**
 * Create multiple learners for the authenticated guide.
 * Each learner gets a username and password.
 */
export async function addLearners(
  learners: { first_name: string; last_name: string; username: string; password: string }[]
): Promise<AddLearnersResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }
  if (user.user_metadata?.role === 'player') return { error: 'Players cannot add learners.' }

  if (learners.length === 0) return { error: 'No learners provided.' }

  const timezone = user.user_metadata?.timezone || 'America/Chicago'
  const results: AddLearnersResult['results'] = []

  for (let i = 0; i < learners.length; i++) {
    const learner = learners[i]
    const result: CreatePlayerResult = await createPlayerForGuide(
      user.id,
      timezone,
      { username: learner.username, password: learner.password, first_name: learner.first_name, last_name: learner.last_name }
    )

    if (result.error) {
      const fieldMsg = result.fieldErrors
        ? Object.values(result.fieldErrors).flat()[0]
        : result.error
      results.push({ index: i, username: learner.username, error: fieldMsg })
    } else {
      results.push({ index: i, username: learner.username, playerId: result.playerId })
    }
  }

  const hasErrors = results.some((r) => r.error)
  if (hasErrors) {
    return { results }
  }

  return { results }
}
