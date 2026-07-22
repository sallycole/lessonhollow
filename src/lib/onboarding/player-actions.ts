'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/db'
import { MAX_PLAYERS_PER_GUIDE } from '@/lib/constants'
import { z } from 'zod'

export type CreatePlayerResult = {
  error?: string
  fieldErrors?: Record<string, string[]>
  playerId?: string
  playerName?: string
  playerAuthUserId?: string
}

const createPlayerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, hyphens, and underscores'
    ),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

/**
 * Create a player for a guide.
 * Creates a Supabase Auth user with placeholder email and a player DB record.
 * Pass `isGuidePlayer: true` when creating the player record that represents
 * the guide themselves (player 1, during onboarding signup).
 */
export async function createPlayerForGuide(
  guideId: string,
  guideTimezone: string,
  data: {
    username: string
    password: string
    first_name?: string
    last_name?: string
    isGuidePlayer?: boolean
  }
): Promise<CreatePlayerResult> {
  const result = createPlayerSchema.safeParse(data)
  if (!result.success) {
    return {
      error: 'Validation failed.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // Check player limit
  const { count } = await db.getPlayerCountByGuide(guideId)
  if ((count ?? 0) >= MAX_PLAYERS_PER_GUIDE) {
    return { error: `You can have at most ${MAX_PLAYERS_PER_GUIDE} players.` }
  }

  // Check username uniqueness
  const { data: existing } = await db.getPlayerByUsernameCaseInsensitive(data.username)
  if (existing) {
    return {
      error: 'Validation failed.',
      fieldErrors: { username: ['This username is already taken.'] },
    }
  }

  // Create Supabase Auth user
  const placeholderEmail = `${data.username}@player.lessonhollow.local`
  const admin = createAdminClient()

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: placeholderEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { role: 'player' },
    })

  if (authError || !authData.user) {
    return { error: 'Failed to create player account. Please try again.' }
  }

  // Create player record
  const firstName = data.first_name || data.username
  const lastName = data.last_name || ''
  const { data: player, error: dbError } = await db.createPlayer({
    guide_id: guideId,
    username: data.username,
    first_name: firstName,
    last_name: lastName,
    time_zone: guideTimezone || 'America/Chicago',
    auth_user_id: authData.user.id,
    is_guide_player: data.isGuidePlayer ?? false,
  })

  if (dbError || !player) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: 'Failed to save player. Please try again.' }
  }

  revalidatePath('/players')
  revalidatePath('/dashboard')
  return {
    playerId: player.id,
    playerName: `${firstName} ${lastName}`.trim(),
    playerAuthUserId: authData.user.id,
  }
}

/**
 * Mark onboarding as completed in user metadata.
 */
export async function completeOnboarding(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      onboarding_completed: true,
    },
  })

  if (error) return { error: 'Failed to update profile.' }

  revalidatePath('/dashboard')
  return {}
}
