'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveUser, resolvePlayerContext } from '@/lib/masquerade'
import { selectTasks, type EnrollmentContext } from '@/lib/task-selector'
import { resolveTimeZone, todayInTimeZone } from '@/lib/date-tz'
import { z } from 'zod'

export async function finishedForTodayAction(): Promise<{
  error?: string
  completedCount?: number
  unfinishedCount?: number
}> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Fetch promoted tasks and today's completed tasks (player-local day)
  const { data: player } = await db.getPlayerById(resolvedPlayerId)
  const timeZone = resolveTimeZone(player?.time_zone ?? null)
  const todayDate = todayInTimeZone(timeZone)
  const [promotedResult, completedResult] = await Promise.all([
    db.getPromotedTasksForToday(resolvedPlayerId),
    db.getCompletedTasksToday(resolvedPlayerId, todayDate, timeZone),
  ])

  const promotedTaskIds = (promotedResult.data ?? []).map(
    (t: Record<string, unknown>) => t.id as string
  )
  const completedTaskIds = (completedResult.data ?? []).map(
    (t: Record<string, unknown>) => t.id as string
  )

  // Clear the Today list
  const { error: clearError } = await db.clearTodayList(promotedTaskIds, completedTaskIds)
  if (clearError) {
    return { error: 'Failed to clear today list.' }
  }

  revalidatePath('/today')
  revalidatePath('/plan')

  return {
    completedCount: completedTaskIds.length,
    unfinishedCount: promotedTaskIds.length,
  }
}

export async function startTaskAction(
  playerTaskId: string
): Promise<{ error?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  if (!playerTaskId || typeof playerTaskId !== 'string') {
    return { error: 'Invalid task ID.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Verify the task belongs to this player
  const ownsTask = await db.verifyPlayerOwnsTask(resolvedPlayerId, playerTaskId)
  if (!ownsTask) {
    return { error: 'Task not found.' }
  }

  // Start the task (auto-pauses any other active task)
  const { error: startError } = await db.startTask(playerTaskId, resolvedPlayerId)
  if (startError) {
    return { error: 'Failed to start task.' }
  }

  revalidatePath('/today')
  return {}
}

export async function pauseTaskAction(
  playerTaskId: string
): Promise<{ error?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  if (!playerTaskId || typeof playerTaskId !== 'string') {
    return { error: 'Invalid task ID.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Verify the task belongs to this player
  const ownsTask = await db.verifyPlayerOwnsTask(resolvedPlayerId, playerTaskId)
  if (!ownsTask) {
    return { error: 'Task not found.' }
  }

  const { error: pauseError } = await db.pauseTask(playerTaskId)
  if (pauseError) {
    return { error: 'Failed to pause task.' }
  }

  revalidatePath('/today')
  return {}
}

export async function unpauseTaskAction(
  playerTaskId: string
): Promise<{ error?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  if (!playerTaskId || typeof playerTaskId !== 'string') {
    return { error: 'Invalid task ID.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Verify the task belongs to this player
  const ownsTask = await db.verifyPlayerOwnsTask(resolvedPlayerId, playerTaskId)
  if (!ownsTask) {
    return { error: 'Task not found.' }
  }

  // Unpause uses the same "only one active task" invariant as start
  const { error: unpauseError } = await db.unpauseTask(playerTaskId, resolvedPlayerId)
  if (unpauseError) {
    return { error: 'Failed to unpause task.' }
  }

  revalidatePath('/today')
  return {}
}

export async function completeTaskAction(
  playerTaskId: string,
  confirmedSeconds?: number
): Promise<{ error?: string; enrollmentFinished?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  if (!playerTaskId || typeof playerTaskId !== 'string') {
    return { error: 'Invalid task ID.' }
  }

  // Validate confirmedSeconds if provided
  if (confirmedSeconds !== undefined) {
    if (typeof confirmedSeconds !== 'number' || confirmedSeconds < 0 || confirmedSeconds > 86400) {
      return { error: 'Duration must be between 0 and 86400 seconds (24 hours).' }
    }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Verify the task belongs to this player
  const ownsTask = await db.verifyPlayerOwnsTask(resolvedPlayerId, playerTaskId)
  if (!ownsTask) {
    return { error: 'Task not found.' }
  }

  const { data: completedTask, error: completeError } = await db.completeTask(playerTaskId, confirmedSeconds)
  if (completeError) {
    console.error('completeTask error:', completeError)
    return { error: `Failed to complete task: ${completeError.message ?? 'unknown error'}` }
  }

  // Auto-finish enrollment when all tasks are completed
  let enrollmentFinished: string | undefined
  if (completedTask?.enrollment_id) {
    const { count } = await db.getRemainingTaskCountForEnrollment(completedTask.enrollment_id)
    if (count === 0) {
      await db.updateEnrollment(completedTask.enrollment_id, {
        status: 'finished',
      })
      // Look up curriculum name for the congratulations message
      const { data: enrollment } = await db.getEnrollmentById(completedTask.enrollment_id)
      const curricula = enrollment?.curricula as { name: string } | null
      enrollmentFinished = curricula?.name ?? 'your curriculum'
    }
  }

  revalidatePath('/today')
  revalidatePath('/plan')
  return enrollmentFinished ? { enrollmentFinished } : {}
}

export async function unfinishTaskAction(
  playerTaskId: string
): Promise<{ error?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  if (!playerTaskId || typeof playerTaskId !== 'string') {
    return { error: 'Invalid task ID.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  const ownsTask = await db.verifyPlayerOwnsTask(resolvedPlayerId, playerTaskId)
  if (!ownsTask) {
    return { error: 'Task not found.' }
  }

  const { error: unfinishError } = await db.unfinishTask(playerTaskId)
  if (unfinishError) {
    console.error('unfinishTask error:', unfinishError)
    return { error: `Failed to return task to plan: ${unfinishError.message ?? 'unknown error'}` }
  }

  revalidatePath('/today')
  revalidatePath('/plan')
  return {}
}

const reorderSchema = z.array(
  z.object({
    id: z.string().uuid(),
    display_order: z.number().int().min(0),
  })
)

export async function reorderTodayTasksAction(
  updates: Array<{ id: string; display_order: number }>
): Promise<{ error?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const parsed = reorderSchema.safeParse(updates)
  if (!parsed.success) {
    return { error: 'Invalid reorder data.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Verify all tasks belong to this player
  for (const update of parsed.data) {
    const ownsTask = await db.verifyPlayerOwnsTask(resolvedPlayerId, update.id)
    if (!ownsTask) {
      return { error: 'Task not found.' }
    }
  }

  const { error: dbError } = await db.updateTodayTaskOrder(parsed.data)
  if (dbError) {
    return { error: 'Failed to save task order.' }
  }

  revalidatePath('/today')
  return {}
}

export async function autoPopulateAction(
  taskCount: number
): Promise<{ error?: string; promotedCount?: number }> {
  if (taskCount < 1 || taskCount > 20 || !Number.isInteger(taskCount)) {
    return { error: 'Task count must be between 1 and 20.' }
  }

  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Get active enrollments with curricula
  const { data: enrollments, error: enrollErr } = await db.getActiveEnrollmentsWithCurricula(resolvedPlayerId)
  if (enrollErr || !enrollments || enrollments.length === 0) {
    return { error: 'No active enrollments found.' }
  }

  // Build EnrollmentContext for each enrollment in parallel
  const contexts: EnrollmentContext[] = await Promise.all(
    enrollments.map(async (enrollment: Record<string, unknown>) => {
      const enrollmentId = enrollment.id as string
      const curriculum = enrollment.curricula as Record<string, unknown> | null

      const [pendingResult, taskCountResult, completedCountResult] = await Promise.all([
        db.getPendingTasksForEnrollment(enrollmentId),
        db.getTaskCountForCurriculum(enrollment.curriculum_id as string),
        db.getCompletedTaskCountForEnrollment(enrollmentId),
      ])

      let completedLoops = 0
      if (enrollment.enrollment_type === 'memorization') {
        completedLoops = await db.getCompletedLoopCountForEnrollment(enrollmentId)
      }

      return {
        enrollmentId,
        enrollmentType: enrollment.enrollment_type as EnrollmentContext['enrollmentType'],
        targetCompletionDate: (enrollment.target_completion_date as string) ?? null,
        studyDaysPerWeek: (enrollment.study_days_per_week as number) ?? 5,
        totalTasks: taskCountResult.count ?? 0,
        completedTasks: completedCountResult.count ?? 0,
        targetLoops: (enrollment.target_loops as number) ?? undefined,
        completedLoops: completedLoops || undefined,
        pendingTasks: pendingResult.data ?? [],
        curriculumTitle: (curriculum?.name as string) ?? 'Unknown',
        startDate: (enrollment.start_date as string) ?? undefined,
      }
    })
  )

  // Run deterministic task selection against the player's local day, so
  // start-date gating and pacing don't flip a day early in the evening.
  const { data: player } = await db.getPlayerById(resolvedPlayerId)
  const today = todayInTimeZone(resolveTimeZone(player?.time_zone ?? null))
  const selections = selectTasks(contexts, taskCount, today)

  if (selections.length === 0) {
    return { error: 'No tasks available to promote.' }
  }

  // Batch-promote all selected tasks (promoteTask already handles duplicates)
  const results = await Promise.all(
    selections.map((s) => db.promoteTask(s.enrollmentId, s.taskId, s.loopNumber))
  )

  const failCount = results.filter((r) => r.error).length
  if (failCount === results.length) {
    return { error: 'Failed to promote tasks. Please try again.' }
  }

  revalidatePath('/today')
  revalidatePath('/plan')
  return { promotedCount: results.length - failCount }
}

export async function removeTaskAction(
  playerTaskId: string
): Promise<{ error?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  if (!playerTaskId || typeof playerTaskId !== 'string') {
    return { error: 'Invalid task ID.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Verify the task belongs to this player
  const ownsTask = await db.verifyPlayerOwnsTask(resolvedPlayerId, playerTaskId)
  if (!ownsTask) {
    return { error: 'Task not found.' }
  }

  // Can only remove promoted (not started/completed) tasks
  const { data: playerTask } = await db.getPlayerTaskById(playerTaskId)
  if (!playerTask || playerTask.status !== 'promoted' || playerTask.started_at) {
    return { error: 'Only not-started tasks can be removed.' }
  }

  const { error: unpromoteErr } = await db.unpromoteTask(playerTaskId)
  if (unpromoteErr) {
    return { error: 'Failed to remove task. Please try again.' }
  }

  revalidatePath('/today')
  revalidatePath('/plan')
  return {}
}

const updateTaskContentSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title must be 500 characters or fewer'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer'),
  resource_url: z
    .string()
    .refine(
      (val) => !val || /^https?:\/\/.+/.test(val),
      'Must be a valid URL (starting with http:// or https://)'
    ),
})

export async function updateTaskContentAction(
  taskId: string,
  input: { title: string; description: string; resourceUrl: string }
): Promise<{ error?: string; fieldErrors?: Record<string, string[]> }> {
  // Real logged-in user (not masquerade) — only Guides can edit
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be logged in.' }
  }
  if (user.user_metadata?.role === 'player') {
    return { error: 'Only Guides can edit tasks.' }
  }

  if (!taskId || typeof taskId !== 'string') {
    return { error: 'Invalid task ID.' }
  }

  // Verify task exists and Guide owns its curriculum
  // (either directly, or indirectly via a managed player who created it)
  const { data: task } = await db.getTaskById(taskId)
  if (!task) {
    return { error: 'Task not found.' }
  }

  const owns = await db.verifyGuideOwnsCurriculum(user.id, task.curriculum_id)
  if (!owns) {
    return { error: 'You do not own this curriculum.' }
  }

  const parsed = updateTaskContentSchema.safeParse({
    title: input.title.trim(),
    description: input.description.trim(),
    resource_url: input.resourceUrl.trim(),
  })
  if (!parsed.success) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { error: dbErr } = await db.updateTask(taskId, {
    title: parsed.data.title,
    description: parsed.data.description,
    resource_url: parsed.data.resource_url,
  })
  if (dbErr) {
    return { error: 'Failed to update task. Please try again.' }
  }

  revalidatePath('/today')
  revalidatePath(`/curriculums/${task.curriculum_id}`)
  return {}
}
