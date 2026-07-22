'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getEffectiveUser, resolvePlayerContext } from '@/lib/masquerade'
import { z } from 'zod'

function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const updateProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  time_zone: z.string().refine(isValidTimeZone, 'Invalid time zone'),
})

export type ProfileActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

export async function updateProfileAction(
  playerId: string,
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId || resolvedPlayerId !== playerId) {
    return { error: 'Profile not found.' }
  }

  const raw = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    time_zone: formData.get('time_zone') as string,
  }

  const result = updateProfileSchema.safeParse(raw)
  if (!result.success) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { error: dbError } = await db.updatePlayer(playerId, result.data)
  if (dbError) {
    return { error: 'Failed to update profile. Please try again.' }
  }

  revalidatePath('/enrollments')
  return { success: true }
}

// --- Enrollment Settings ---

const updateEnrollmentSettingsSchema = z
  .object({
    enrollment_id: z.string().uuid('Invalid enrollment'),
    enrollment_type: z.enum(['core', 'elective', 'memorization'], {
      message: 'Please select an enrollment type.',
    }),
    target_completion_date: z.string().optional(),
    start_date: z.string().optional(),
    study_days_per_week: z.coerce
      .number({ message: 'Please select study days per week.' })
      .min(0.5, 'Study days must be at least 0.5.')
      .max(7, 'Study days cannot exceed 7.')
      .refine(
        (val) => val * 2 === Math.round(val * 2),
        'Study days must be in half-day increments.'
      ),
    target_loops: z.coerce.number().int().optional(),
  })
  .refine(
    (data) => {
      if (data.enrollment_type !== 'core') return true
      return !!data.target_completion_date
    },
    {
      message: 'A target completion date is required for core enrollments.',
      path: ['target_completion_date'],
    }
  )
  .refine(
    (data) => {
      if (data.enrollment_type !== 'memorization') return true
      return !!data.target_completion_date
    },
    {
      message: 'A target completion date is required for memorization enrollments.',
      path: ['target_completion_date'],
    }
  )
  .refine(
    (data) => {
      if (data.enrollment_type !== 'memorization') return true
      return data.target_loops !== undefined && data.target_loops >= 1
    },
    {
      message: 'Target loops must be at least 1.',
      path: ['target_loops'],
    }
  )
  .refine(
    (data) => {
      if (!data.start_date || !data.target_completion_date) return true
      return data.start_date < data.target_completion_date
    },
    {
      message: 'Start date must be before the target completion date.',
      path: ['start_date'],
    }
  )

export type EnrollmentSettingsActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

export async function updateEnrollmentSettingsAction(
  _prev: EnrollmentSettingsActionState,
  formData: FormData
): Promise<EnrollmentSettingsActionState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  const raw = {
    enrollment_id: formData.get('enrollment_id') as string,
    enrollment_type: formData.get('enrollment_type') as string,
    target_completion_date: (formData.get('target_completion_date') as string) || undefined,
    start_date: (formData.get('start_date') as string) || undefined,
    target_loops: (formData.get('target_loops') as string) || undefined,
    study_days_per_week: (formData.get('study_days_per_week') as string) || undefined,
  }

  const result = updateEnrollmentSettingsSchema.safeParse(raw)
  if (!result.success) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { enrollment_id, enrollment_type, target_completion_date, start_date, study_days_per_week, target_loops } = result.data

  // Verify enrollment belongs to this player
  const ownsEnrollment = await db.verifyPlayerOwnsEnrollment(resolvedPlayerId, enrollment_id)
  if (!ownsEnrollment) {
    return { error: 'Enrollment not found.' }
  }

  const updateData: Record<string, unknown> = {
    enrollment_type,
    study_days_per_week,
  }

  // Set target_completion_date based on type
  if (enrollment_type === 'core' || enrollment_type === 'memorization') {
    updateData.target_completion_date = target_completion_date
  } else if (enrollment_type === 'elective' && target_completion_date) {
    updateData.target_completion_date = target_completion_date
  } else {
    updateData.target_completion_date = null
  }

  // Set target_loops for memorization
  if (enrollment_type === 'memorization' && target_loops) {
    updateData.target_loops = target_loops
  } else {
    updateData.target_loops = null
  }

  // Start date is NOT NULL in the DB — only update when provided
  if (start_date) {
    updateData.start_date = start_date
  }

  const { error: dbError } = await db.updateEnrollment(enrollment_id, updateData as Parameters<typeof db.updateEnrollment>[1])
  if (dbError) {
    return { error: 'Failed to update enrollment settings. Please try again.' }
  }

  revalidatePath('/enrollments')
  return { success: true }
}

// --- Remaining Task Count ---

export async function getRemainingTaskCountAction(
  enrollmentId: string
): Promise<{ count: number; error?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { count: 0, error: 'You must be logged in.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { count: 0, error: 'No player account found.' }
  }

  // Verify enrollment belongs to this player
  const ownsEnrollment = await db.verifyPlayerOwnsEnrollment(resolvedPlayerId, enrollmentId)
  if (!ownsEnrollment) {
    return { count: 0, error: 'Enrollment not found.' }
  }

  const { count } = await db.getRemainingTaskCountForEnrollment(enrollmentId)
  return { count }
}

// --- Finish Enrollment ---

export type FinishEnrollmentActionState = {
  error?: string
  success?: boolean
  skippedCount?: number
}

export async function finishEnrollmentAction(
  enrollmentId: string
): Promise<FinishEnrollmentActionState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Verify enrollment belongs to this player
  const ownsEnrollment = await db.verifyPlayerOwnsEnrollment(resolvedPlayerId, enrollmentId)
  if (!ownsEnrollment) {
    return { error: 'Enrollment not found.' }
  }

  const { data: enrollment, error: fetchErr } = await db.getEnrollmentById(enrollmentId)
  if (fetchErr || !enrollment) {
    return { error: 'Enrollment not found.' }
  }

  const currentStatus = (enrollment as Record<string, unknown>).status as string
  if (currentStatus === 'finished') {
    return { error: 'This enrollment is already finished.' }
  }

  // Get remaining task count before finishing
  const { count: remainingCount } = await db.getRemainingTaskCountForEnrollment(enrollmentId)

  // Skip all remaining tasks
  const { error: skipError } = await db.skipRemainingTasksForEnrollment(enrollmentId)
  if (skipError) {
    return { error: 'Failed to skip remaining tasks. Please try again.' }
  }

  // Set enrollment status to finished
  const { error: dbError } = await db.updateEnrollment(enrollmentId, { status: 'finished' })
  if (dbError) {
    return { error: 'Failed to finish enrollment. Please try again.' }
  }

  revalidatePath('/enrollments')
  return { success: true, skippedCount: remainingCount }
}

// --- Unenroll ---

export type UnenrollActionState = {
  error?: string
  success?: boolean
}

export async function unenrollAction(
  enrollmentId: string
): Promise<UnenrollActionState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Verify enrollment belongs to this player
  const ownsEnrollment = await db.verifyPlayerOwnsEnrollment(resolvedPlayerId, enrollmentId)
  if (!ownsEnrollment) {
    return { error: 'Enrollment not found.' }
  }

  // Delete all player_tasks for this enrollment
  const { error: deleteTasksError } = await db.deletePlayerTasksByEnrollment(enrollmentId)
  if (deleteTasksError) {
    return { error: 'Failed to remove task records. Please try again.' }
  }

  // Delete the enrollment itself
  const { error: deleteError } = await db.deleteEnrollment(enrollmentId)
  if (deleteError) {
    return { error: 'Failed to unenroll. Please try again.' }
  }

  revalidatePath('/enrollments')
  return { success: true }
}

// --- Pause / Unpause Toggle ---

export type ToggleStatusActionState = {
  error?: string
  success?: boolean
}

export async function toggleEnrollmentStatusAction(
  enrollmentId: string,
  newStatus: 'active' | 'paused'
): Promise<ToggleStatusActionState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Verify enrollment belongs to this player
  const ownsEnrollment = await db.verifyPlayerOwnsEnrollment(resolvedPlayerId, enrollmentId)
  if (!ownsEnrollment) {
    return { error: 'Enrollment not found.' }
  }

  const { data: enrollment, error: fetchErr } = await db.getEnrollmentById(enrollmentId)
  if (fetchErr || !enrollment) {
    return { error: 'Enrollment not found.' }
  }

  const currentStatus = (enrollment as Record<string, unknown>).status as string
  // Only allow toggling between active and paused
  if (newStatus === 'paused' && currentStatus !== 'active') {
    return { error: 'Only active enrollments can be paused.' }
  }
  if (newStatus === 'active' && currentStatus !== 'paused') {
    return { error: 'Only paused enrollments can be unpaused.' }
  }

  const { error: dbError2 } = await db.updateEnrollment(enrollmentId, { status: newStatus })
  if (dbError2) {
    return { error: 'Failed to update enrollment status. Please try again.' }
  }

  revalidatePath('/enrollments')
  return { success: true }
}
