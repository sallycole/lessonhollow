'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

export async function approveEnrollmentRequestAction(
  requestId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: request, error: fetchErr } = await db.getEnrollmentRequestById(requestId)
  if (fetchErr || !request || request.guide_id !== user.id) {
    return { error: 'Request not found.' }
  }
  if (request.status !== 'pending') {
    return { error: 'Request already processed.' }
  }

  // Check for existing enrollment
  const { data: existing } = await db.getEnrollmentByPlayerAndCurriculum(
    request.player_id,
    request.curriculum_id
  )
  if (existing) {
    await db.updateEnrollmentRequestStatus(requestId, 'denied', 'Already enrolled.')
    revalidatePath('/dashboard')
    return { error: 'Player is already enrolled in this curriculum.' }
  }

  // Build description for credit ledger
  const players = request.players as { first_name: string } | null
  const curricula = request.curricula as { name: string } | null
  const playerName = players?.first_name ?? 'Player'
  const curriculumName = curricula?.name ?? 'Curriculum'
  const description = `${curriculumName} → ${playerName}`

  // Create enrollment and spend credit atomically
  const { data: enrollmentId, error: rpcError } = await db.enrollWithCredit({
    guideUserId: user.id,
    playerId: request.player_id,
    curriculumId: request.curriculum_id,
    enrollmentType: request.enrollment_type,
    studyDaysPerWeek: Number(request.study_days_per_week),
    ...(request.target_completion_date
      ? { targetCompletionDate: request.target_completion_date }
      : {}),
    ...(request.enrollment_type === 'memorization' && request.target_loops
      ? { targetLoops: request.target_loops }
      : {}),
    ...(request.start_date ? { startDate: request.start_date } : {}),
    description,
    tasksPerStudyDay: request.tasks_per_study_day,
  })

  if (rpcError) {
    console.error('Enrollment approval RPC error:', rpcError.message)
    if (rpcError.message?.includes('INSUFFICIENT_CREDITS')) {
      return { error: 'Not enough credits. Top up before approving.' }
    }
    if (rpcError.message?.includes('NO_CREDIT_ACCOUNT')) {
      return { error: 'Credit account not found.' }
    }
    return { error: `Enrollment failed: ${rpcError.message}` }
  }

  if (!enrollmentId) {
    return { error: 'Failed to create enrollment.' }
  }

  await db.updateEnrollmentRequestStatus(requestId, 'approved')
  revalidatePath('/dashboard')
  return {}
}

export async function denyEnrollmentRequestAction(
  requestId: string,
  response?: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: request, error: fetchErr } = await db.getEnrollmentRequestById(requestId)
  if (fetchErr || !request || request.guide_id !== user.id) {
    return { error: 'Request not found.' }
  }
  if (request.status !== 'pending') {
    return { error: 'Request already processed.' }
  }

  await db.updateEnrollmentRequestStatus(requestId, 'denied', response)
  revalidatePath('/dashboard')
  return {}
}
