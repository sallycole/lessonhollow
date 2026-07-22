'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getEffectiveUser, resolvePlayerContext } from '@/lib/masquerade'

export type PromoteTaskActionState = {
  error?: string
  success?: boolean
  promotedTaskTitle?: string
}

export async function promoteNextTaskAction(
  enrollmentId: string
): Promise<PromoteTaskActionState> {
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

  // Find the next promotable task
  const { data: nextTask, error: nextErr } = await db.getNextPromotableTask(enrollmentId)
  if (nextErr) {
    return { error: 'Failed to find next task. Please try again.' }
  }
  if (!nextTask) {
    return { error: 'No tasks available to promote.' }
  }

  // Promote the task
  const { error: promoteErr } = await db.promoteTask(
    enrollmentId,
    nextTask.taskId,
    nextTask.loopNumber
  )
  if (promoteErr) {
    return { error: 'Failed to promote task. Please try again.' }
  }

  revalidatePath('/plan')
  revalidatePath('/today')
  return { success: true, promotedTaskTitle: nextTask.taskTitle }
}

export async function promoteSpecificTaskAction(
  enrollmentId: string,
  taskId: string,
  loopNumber: number = 1
): Promise<PromoteTaskActionState> {
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

  // Promote the specific task
  const { error: promoteErr } = await db.promoteTask(enrollmentId, taskId, loopNumber)
  if (promoteErr) {
    return { error: 'Failed to promote task. Please try again.' }
  }

  revalidatePath('/today')
  return { success: true }
}

export async function skipTaskAction(
  enrollmentId: string,
  taskId: string,
  loopNumber: number = 1
): Promise<PromoteTaskActionState> {
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

  // Skip the task
  const { error: skipErr } = await db.skipTask(enrollmentId, taskId, loopNumber)
  if (skipErr) {
    return { error: 'Failed to skip task. Please try again.' }
  }

  revalidatePath('/today')
  return { success: true }
}

/**
 * Fetch ALL upcoming tasks for an enrollment (no limit).
 * Called once to preload the full curriculum so subsequent promotes are instant.
 */
export async function fetchAllUpcomingTasksAction(
  enrollmentId: string
): Promise<{
  tasks: { task_id: string; title: string; description: string | null; resource_url: string | null; action_type: 'Read' | 'Watch' | 'Listen' | 'Do'; status: 'pending' | 'promoted'; loop_number: number }[]
}> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) return { tasks: [] }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) return { tasks: [] }

  const ownsEnrollment = await db.verifyPlayerOwnsEnrollment(resolvedPlayerId, enrollmentId)
  if (!ownsEnrollment) return { tasks: [] }

  const { data: upcoming } = await db.getUpcomingTasks(enrollmentId, 10000)

  return {
    tasks: (upcoming ?? []).map((t) => ({
      task_id: t.taskId,
      title: t.taskTitle,
      description: t.taskDescription,
      resource_url: t.resourceUrl,
      action_type: t.actionType,
      status: t.status,
      loop_number: t.loopNumber,
    })),
  }
}

export async function unpromoteTaskAction(
  playerTaskId: string
): Promise<PromoteTaskActionState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
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

  // Unpromote the task (resets to pending, clears promoted_at)
  const { error: unpromoteErr } = await db.unpromoteTask(playerTaskId)
  if (unpromoteErr) {
    return { error: 'Failed to unpromote task. Please try again.' }
  }

  revalidatePath('/plan')
  revalidatePath('/today')
  return { success: true }
}
