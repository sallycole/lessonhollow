'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/db'
import { encryptPassword } from '@/lib/crypto'
import { parseCsv } from '@/lib/csv-parser'
import { MAX_PLAYERS_PER_GUIDE, ACTION_TYPES, GRADE_LEVELS, type GradeLevel } from '@/lib/constants'
import { z } from 'zod'

export type OnboardingActionResult = {
  error?: string
  fieldErrors?: Record<string, string[]>
  playerId?: string
  playerName?: string
  playerAuthUserId?: string
  curriculumId?: string
}

async function getAuthenticatedGuide() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (user.user_metadata?.role === 'player') return null
  return user
}

/**
 * Save fal.ai API key for the guide.
 * Stores it in user_api_keys with service='fal_ai'.
 */
export async function saveFalApiKey(key: string): Promise<OnboardingActionResult> {
  const user = await getAuthenticatedGuide()
  if (!user) return { error: 'You must be logged in as a guide.' }

  const trimmed = key.trim()
  if (!trimmed) return { error: 'API key is required.' }

  // Validate key with a lightweight API call (no content generated)
  try {
    const resp = await fetch(
      'https://queue.fal.run/fal-ai/flux/schnell/requests/00000000-0000-0000-0000-000000000000',
      {
        method: 'GET',
        headers: { 'Authorization': `Key ${trimmed}` },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (resp.status === 401 || resp.status === 403) {
      return { error: 'Invalid API key — check and retry.' }
    }
  } catch {
    // Network errors shouldn't block saving
  }

  const { error } = await db.upsertUserApiKey({
    user_id: user.id,
    service: 'fal_ai',
    encrypted_key: encryptPassword(trimmed),
  })

  if (error) return { error: 'Failed to save API key. Please try again.' }

  revalidatePath('/dashboard')
  return {}
}

const createPlayerSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
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
 * Create a player during onboarding.
 * Returns the player ID and auth user ID for use in subsequent steps.
 */
export async function createOnboardingPlayer(
  formData: FormData
): Promise<OnboardingActionResult> {
  const user = await getAuthenticatedGuide()
  if (!user) return { error: 'You must be logged in as a guide.' }

  const raw = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    username: formData.get('username') as string,
    password: formData.get('password') as string,
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
  const { data: player, error: dbError } = await db.createPlayer({
    guide_id: user.id,
    username: data.username,
    first_name: data.first_name,
    last_name: data.last_name,
    time_zone: user.user_metadata?.timezone || 'America/Chicago',
    auth_user_id: authData.user.id,
  })

  if (dbError || !player) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: 'Failed to save player. Please try again.' }
  }

  revalidatePath('/players')
  revalidatePath('/dashboard')
  return {
    playerId: player.id,
    playerName: `${data.first_name} ${data.last_name}`,
    playerAuthUserId: authData.user.id,
  }
}

const createCurriculumSchema = z.object({
  name: z.string().min(1, 'Curriculum name is required').max(200),
})

/**
 * Create an empty curriculum during onboarding.
 * Runs in masquerade context — curriculum is owned by the player.
 */
export async function createOnboardingCurriculum(
  playerAuthUserId: string,
  name: string
): Promise<OnboardingActionResult> {
  const user = await getAuthenticatedGuide()
  if (!user) return { error: 'You must be logged in as a guide.' }

  const ownsPlayer = await db.verifyGuideOwnsPlayerByAuthUserId(user.id, playerAuthUserId)
  if (!ownsPlayer) return { error: 'Player not found.' }

  const result = createCurriculumSchema.safeParse({ name: name.trim() })
  if (!result.success) {
    return {
      error: result.error.issues[0]?.message ?? 'Invalid curriculum name.',
    }
  }

  const { data: curriculum, error } = await db.createCurriculum({
    user_id: playerAuthUserId,
    name: result.data.name,
  })

  if (error || !curriculum) {
    return { error: 'Failed to create curriculum. Please try again.' }
  }

  revalidatePath('/curriculums')
  return { curriculumId: curriculum.id as string }
}

const csvTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  action_type: z.enum(ACTION_TYPES),
  resource_url: z.string().optional(),
})

const csvDataSchema = z.object({
  curriculum: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    resource_url: z.string().optional(),
    publisher: z.string().max(200).optional(),
    grade_level: z
      .string()
      .optional()
      .refine(
        (val) => !val || (GRADE_LEVELS as readonly string[]).includes(val),
        'Invalid grade level'
      ),
  }),
  tasks: z.array(csvTaskSchema).min(1, 'At least one task is required'),
})

/**
 * Create a curriculum from CSV during onboarding.
 * Runs in masquerade context — curriculum is owned by the player.
 */
export async function createOnboardingCurriculumFromCsv(
  playerAuthUserId: string,
  csvContent: string
): Promise<OnboardingActionResult> {
  const user = await getAuthenticatedGuide()
  if (!user) return { error: 'You must be logged in as a guide.' }

  const ownsPlayer = await db.verifyGuideOwnsPlayerByAuthUserId(user.id, playerAuthUserId)
  if (!ownsPlayer) return { error: 'Player not found.' }

  const parsed = parseCsv(csvContent)
  if (parsed.errors.length > 0) {
    return { error: parsed.errors[0].message }
  }

  const result = csvDataSchema.safeParse({
    curriculum: parsed.curriculum,
    tasks: parsed.tasks,
  })
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid CSV data.' }
  }

  const { curriculum: meta, tasks } = result.data

  // Create curriculum under the player's account
  const { data: curriculum, error: currError } = await db.createCurriculum({
    user_id: playerAuthUserId,
    name: meta.name,
    description: meta.description,
    resource_url: meta.resource_url,
    publisher: meta.publisher,
    grade_level: meta.grade_level as GradeLevel | undefined,
  })

  if (currError || !curriculum) {
    return { error: 'Failed to create curriculum. Please try again.' }
  }

  // Bulk create tasks
  const taskData = tasks.map((task, idx) => ({
    curriculum_id: curriculum.id as string,
    title: task.title,
    description: task.description,
    action_type: task.action_type,
    resource_url: task.resource_url,
    position: (idx + 1) * 10,
  }))

  const { error: tasksError } = await db.createTasks(taskData)
  if (tasksError) {
    await db.deleteCurriculum(curriculum.id as string)
    return { error: 'Failed to create tasks. Please try again.' }
  }

  revalidatePath('/curriculums')
  return { curriculumId: curriculum.id as string }
}

/**
 * Mark onboarding as completed in user metadata.
 */
export async function completeOnboarding(): Promise<OnboardingActionResult> {
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
