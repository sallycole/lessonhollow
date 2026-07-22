'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getEffectiveUser, resolvePlayerContext } from '@/lib/masquerade'
import { sendEnrollmentRequestEmail } from '@/lib/notifications'
import { z } from 'zod'

const enrollmentSchema = z
  .object({
    curriculum_id: z.string().uuid('Invalid curriculum'),
    enrollment_type: z.enum(['core', 'elective', 'memorization'], {
      message: 'Please select an enrollment type.',
    }),
    target_completion_date: z.string().optional(),
    start_date: z.string().optional(),
    target_loops: z.coerce.number().int().optional(),
    tasks_per_study_day: z.coerce
      .number({ message: 'Please select tasks per study day.' })
      .int()
      .min(1, 'Must be at least 1 task per day.')
      .max(50, 'Cannot exceed 50 tasks per day.'),
    study_days_per_week: z.coerce
      .number({
        message: 'Please select study days per week.',
      })
      .min(0.5, 'Study days must be at least 0.5.')
      .max(7, 'Study days cannot exceed 7.')
      .refine(
        (val) => val * 2 === Math.round(val * 2),
        'Study days must be in half-day increments (0.5, 1, 1.5, etc.).'
      ),
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
      if (!data.target_completion_date) return true
      if (data.enrollment_type !== 'core' && data.enrollment_type !== 'elective' && data.enrollment_type !== 'memorization') return true
      const target = new Date(data.target_completion_date + 'T00:00:00')
      const tomorrow = new Date()
      tomorrow.setHours(0, 0, 0, 0)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return target >= tomorrow
    },
    {
      message: 'Target date must be at least one day in the future.',
      path: ['target_completion_date'],
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

export type EnrollActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function createEnrollmentAction(
  _prev: EnrollActionState,
  formData: FormData
): Promise<EnrollActionState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const raw = {
    curriculum_id: formData.get('curriculum_id') as string,
    enrollment_type: formData.get('enrollment_type') as string,
    target_completion_date: (formData.get('target_completion_date') as string) || undefined,
    start_date: (formData.get('start_date') as string) || undefined,
    target_loops: (formData.get('target_loops') as string) || undefined,
    study_days_per_week: (formData.get('study_days_per_week') as string) || undefined,
    tasks_per_study_day: (formData.get('tasks_per_study_day') as string) || undefined,
  }

  const result = enrollmentSchema.safeParse(raw)
  if (!result.success) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { curriculum_id, enrollment_type, target_completion_date, start_date, target_loops, study_days_per_week, tasks_per_study_day } = result.data

  // Verify the curriculum exists and belongs to this user
  const { data: curriculum, error: currError } = await db.getCurriculumById(curriculum_id)
  if (currError || !curriculum || curriculum.user_id !== effectiveUser.userId) {
    return { error: 'Curriculum not found.' }
  }

  // Resolve the player ID
  const playerId = await resolvePlayerContext(effectiveUser)
  if (!playerId) {
    return { error: 'No player account found. A guide must masquerade as a player to enroll.' }
  }

  // Check for existing enrollment
  const { data: existing } = await db.getEnrollmentByPlayerAndCurriculum(playerId, curriculum_id)
  if (existing) {
    return { error: 'This player is already enrolled in this curriculum.' }
  }

  // Determine the guide's user ID for credit spending
  const guideUserId = effectiveUser.isMasquerading
    ? effectiveUser.guideUserId!
    : effectiveUser.userId

  // Build description for credit ledger
  const { data: player } = await db.getPlayerById(playerId)
  const playerName = player?.first_name ?? 'Player'
  const description = `${curriculum.name} → ${playerName}`

  // Create enrollment and spend credit atomically in a single Postgres transaction.
  // This prevents orphan enrollment rows if the credit check fails.
  const { data: enrollmentId, error: rpcError } = await db.enrollWithCredit({
    guideUserId,
    playerId,
    curriculumId: curriculum_id,
    enrollmentType: enrollment_type,
    studyDaysPerWeek: study_days_per_week,
    ...((enrollment_type === 'core' || enrollment_type === 'elective' || enrollment_type === 'memorization') && target_completion_date
      ? { targetCompletionDate: target_completion_date }
      : {}),
    ...(enrollment_type === 'memorization' && target_loops
      ? { targetLoops: target_loops }
      : {}),
    ...(start_date ? { startDate: start_date } : {}),
    description,
    tasksPerStudyDay: tasks_per_study_day,
  })

  if (rpcError) {
    console.error('Enrollment RPC error:', rpcError.message, rpcError)
    if (rpcError.message?.includes('INSUFFICIENT_CREDITS')) {
      return { error: "You're out of credits. Top up to enroll more players." }
    }
    if (rpcError.message?.includes('NO_CREDIT_ACCOUNT')) {
      return { error: 'Credit account not found. Please try again or contact support.' }
    }
    return { error: `Failed to create enrollment: ${rpcError.message}` }
  }

  if (!enrollmentId) {
    return { error: 'Failed to create enrollment. Please try again.' }
  }

  revalidatePath('/curriculums')
  revalidatePath('/today')
  redirect(`/curriculums/${curriculum_id}/enrolled`)
}

export async function createEnrollmentRequestAction(
  _prev: EnrollActionState,
  formData: FormData
): Promise<EnrollActionState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  if (effectiveUser.isMasquerading) {
    return { error: 'Guides should enroll directly, not request.' }
  }

  const raw = {
    curriculum_id: formData.get('curriculum_id') as string,
    enrollment_type: formData.get('enrollment_type') as string,
    target_completion_date: (formData.get('target_completion_date') as string) || undefined,
    start_date: (formData.get('start_date') as string) || undefined,
    target_loops: (formData.get('target_loops') as string) || undefined,
    study_days_per_week: (formData.get('study_days_per_week') as string) || undefined,
    tasks_per_study_day: (formData.get('tasks_per_study_day') as string) || undefined,
  }

  const result = enrollmentSchema.safeParse(raw)
  if (!result.success) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { curriculum_id, enrollment_type, target_completion_date, start_date, target_loops, study_days_per_week, tasks_per_study_day } = result.data

  // Verify the curriculum exists and belongs to this user
  const { data: curriculum, error: currError } = await db.getCurriculumById(curriculum_id)
  if (currError || !curriculum || curriculum.user_id !== effectiveUser.userId) {
    return { error: 'Curriculum not found.' }
  }

  // Resolve the player ID
  const playerId = await resolvePlayerContext(effectiveUser)
  if (!playerId) {
    return { error: 'No player account found.' }
  }

  // Check for existing enrollment
  const { data: existing } = await db.getEnrollmentByPlayerAndCurriculum(playerId, curriculum_id)
  if (existing) {
    return { error: 'You are already enrolled in this curriculum.' }
  }

  // Check for existing pending request
  const { data: pendingReq } = await db.getPendingRequestByPlayerAndCurriculum(playerId, curriculum_id)
  if (pendingReq) {
    return { error: 'You already have a pending request for this curriculum.' }
  }

  // Look up the player record to get guide_id
  const { data: player } = await db.getPlayerById(playerId)
  if (!player) {
    return { error: 'Player not found.' }
  }

  const { error: createErr } = await db.createEnrollmentRequest({
    player_id: playerId,
    curriculum_id,
    guide_id: player.guide_id,
    enrollment_type,
    study_days_per_week,
    tasks_per_study_day,
    ...(target_completion_date ? { target_completion_date } : {}),
    ...(enrollment_type === 'memorization' && target_loops ? { target_loops } : {}),
    ...(start_date ? { start_date } : {}),
  })

  if (createErr) {
    console.error('Enrollment request error:', createErr)
    return { error: 'Failed to submit request. Please try again.' }
  }

  // Send email notification to guide (fire-and-forget)
  sendEnrollmentRequestEmail({
    guideId: player.guide_id,
    playerName: `${player.first_name} ${player.last_name}`,
    curriculumName: curriculum.name,
  }).catch(console.error)

  redirect(`/curriculums/${curriculum_id}/request-sent`)
}
