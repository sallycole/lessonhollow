'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/db'
import { MAX_PLAYERS_PER_GUIDE } from '@/lib/constants'
import { z } from 'zod'

function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, hyphens, and underscores'
  )

const createPlayerSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  time_zone: z.string().refine(isValidTimeZone, 'Invalid time zone'),
  video_tasks_required: z.coerce.number().int().nonnegative().optional(),
})

const updatePlayerSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100, 'First name too long').optional(),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Last name too long').optional(),
  time_zone: z.string().refine(isValidTimeZone, 'Invalid time zone').optional(),
  username: usernameSchema.optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  video_tasks_required: z.coerce.number().int().nonnegative().optional(),
})

export type PlayerActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  password?: string
  username?: string
}

async function getAuthenticatedGuide() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  // Only guides (role = 'guide' or no role yet) can manage players
  if (user.user_metadata?.role === 'player') return null
  return user
}

/**
 * Create a new player sub-account.
 * Creates a Supabase Auth user with a placeholder email and the provided password,
 * then creates the player record in the database. Atomic: cleans up auth user if DB insert fails.
 */
export async function createPlayer(
  _prev: PlayerActionState,
  formData: FormData
): Promise<PlayerActionState> {
  const user = await getAuthenticatedGuide()
  if (!user) {
    return { error: 'You must be logged in as a guide.' }
  }

  const raw = {
    username: formData.get('username') as string,
    password: formData.get('password') as string,
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    time_zone: (formData.get('time_zone') as string) || 'America/Chicago',
    video_tasks_required: formData.get('video_tasks_required')
      ? Number(formData.get('video_tasks_required'))
      : undefined,
  }

  const result = createPlayerSchema.safeParse(raw)
  if (!result.success) {
    return {
      error: 'Validation failed.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const data = result.data

  // Check player limit
  const { count } = await db.getPlayerCountByGuide(user.id)
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

  // Create Supabase Auth user with placeholder email
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

  // Create player record in database
  const { error: dbError } = await db.createPlayer({
    guide_id: user.id,
    username: data.username,
    first_name: data.first_name,
    last_name: data.last_name,
    time_zone: data.time_zone,
    auth_user_id: authData.user.id,
    video_tasks_required: data.video_tasks_required,
  })

  if (dbError) {
    // Atomic cleanup: delete the auth user we just created
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: 'Failed to save player. Please try again.' }
  }

  revalidatePath('/players')
  return { success: true, password: data.password, username: data.username }
}

/**
 * Update an existing player sub-account.
 * Only the owning guide can update. If password is changed, updates both
 * the Supabase Auth user password and the encrypted password in the DB.
 */
export async function updatePlayer(
  playerId: string,
  _prev: PlayerActionState,
  formData: FormData
): Promise<PlayerActionState> {
  const user = await getAuthenticatedGuide()
  if (!user) {
    return { error: 'You must be logged in as a guide.' }
  }

  // Verify ownership — return 404-style to avoid confirming resource exists
  const owns = await db.verifyGuideOwnsPlayer(user.id, playerId)
  if (!owns) {
    return { error: 'Player not found.' }
  }

  // Build update object from provided fields only
  const rawUpdate: Record<string, unknown> = {}
  const fields = ['first_name', 'last_name', 'time_zone', 'username', 'password', 'video_tasks_required']
  for (const field of fields) {
    const value = formData.get(field)
    if (value !== null && value !== '') {
      rawUpdate[field] = field === 'video_tasks_required' ? Number(value) : value
    }
  }

  if (Object.keys(rawUpdate).length === 0) {
    return { error: 'No fields to update.' }
  }

  const result = updatePlayerSchema.safeParse(rawUpdate)
  if (!result.success) {
    return {
      error: 'Validation failed.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const data = result.data

  // Check username uniqueness if being changed
  if (data.username) {
    const { data: existing } = await db.getPlayerByUsernameCaseInsensitive(data.username)
    if (existing && existing.id !== playerId) {
      return {
        error: 'Validation failed.',
        fieldErrors: { username: ['This username is already taken.'] },
      }
    }
  }

  // Get current player to find auth_user_id
  const { data: player } = await db.getPlayerById(playerId)
  if (!player) {
    return { error: 'Player not found.' }
  }

  // If password is being changed, update auth user and encrypt new password
  if (data.password && player.auth_user_id) {
    const admin = createAdminClient()
    const { error: authError } = await admin.auth.admin.updateUserById(
      player.auth_user_id,
      { password: data.password }
    )
    if (authError) {
      return { error: 'Failed to update password. Please try again.' }
    }
  }

  // If username is being changed, update the auth user's email too
  if (data.username && player.auth_user_id) {
    const admin = createAdminClient()
    const newEmail = `${data.username}@player.lessonhollow.local`
    await admin.auth.admin.updateUserById(player.auth_user_id, {
      email: newEmail,
    })
  }

  // Build DB update (password goes to Supabase auth above; we stamp
  // player_password_set_at here so the UI can tell "explicitly set via Edit"
  // apart from "auto-copied at signup" for the guide-as-player case).
  const dbUpdate: Record<string, unknown> = {}
  if (data.first_name) dbUpdate.first_name = data.first_name
  if (data.last_name) dbUpdate.last_name = data.last_name
  if (data.time_zone) dbUpdate.time_zone = data.time_zone
  if (data.username) dbUpdate.username = data.username
  if (data.video_tasks_required !== undefined) dbUpdate.video_tasks_required = data.video_tasks_required
  if (data.password) dbUpdate.player_password_set_at = new Date().toISOString()

  const { error: dbError } = await db.updatePlayer(playerId, dbUpdate)
  if (dbError) {
    return { error: 'Failed to update player. Please try again.' }
  }

  revalidatePath('/players')
  return { success: true, password: data.password, username: data.username ?? player.username }
}

/**
 * Delete a player sub-account.
 * Removes the player record (cascades to enrollments, tasks, etc.)
 * and deletes the corresponding Supabase Auth user.
 */
export async function deletePlayer(
  playerId: string
): Promise<PlayerActionState> {
  const user = await getAuthenticatedGuide()
  if (!user) {
    return { error: 'You must be logged in as a guide.' }
  }

  // Verify ownership — return 404-style to avoid confirming resource exists
  const owns = await db.verifyGuideOwnsPlayer(user.id, playerId)
  if (!owns) {
    return { error: 'Player not found.' }
  }

  // Get player to find auth_user_id before deleting
  const { data: player } = await db.getPlayerById(playerId)
  if (!player) {
    return { error: 'Player not found.' }
  }

  // Delete the player record (FK cascades handle enrollments, tasks, etc.)
  const { error: dbError } = await db.deletePlayer(playerId)
  if (dbError) {
    return { error: 'Failed to delete player. Please try again.' }
  }

  // Delete the Supabase Auth user
  if (player.auth_user_id) {
    const admin = createAdminClient()
    await admin.auth.admin.deleteUser(player.auth_user_id)
  }

  revalidatePath('/players')
  return { success: true }
}

/**
 * Get all players for the authenticated guide.
 */
export async function getPlayers() {
  const user = await getAuthenticatedGuide()
  if (!user) {
    return { data: null, error: 'You must be logged in as a guide.' }
  }

  const { data, error } = await db.getPlayersByGuide(user.id)
  return {
    data: data ?? [],
    error: error ? 'Failed to load players.' : undefined,
  }
}

/**
 * Get a single player by ID (only if owned by the authenticated guide).
 */
export async function getPlayer(playerId: string) {
  const user = await getAuthenticatedGuide()
  if (!user) {
    return { data: null, error: 'You must be logged in as a guide.' }
  }

  const owns = await db.verifyGuideOwnsPlayer(user.id, playerId)
  if (!owns) {
    return { data: null, error: 'Player not found.' }
  }

  const { data, error } = await db.getPlayerById(playerId)
  return {
    data: data ?? null,
    error: error ? 'Player not found.' : undefined,
  }
}
