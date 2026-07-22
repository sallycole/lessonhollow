'use server'

import { db } from '@/lib/db'
import { getEffectiveUser, resolvePlayerContext } from '@/lib/masquerade'

export async function getCompletedTaskTextAction(enrollmentId: string) {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'Not authenticated' }
  }

  const playerId = await resolvePlayerContext(effectiveUser)
  if (!playerId) {
    return { error: 'No player context' }
  }

  // Verify enrollment ownership
  const ownsEnrollment = await db.verifyPlayerOwnsEnrollment(playerId, enrollmentId)
  if (!ownsEnrollment) {
    return { error: 'Enrollment not found' }
  }

  const { data, error } = await db.getCompletedTaskTitlesForEnrollment(enrollmentId)
  if (error || !data) {
    return { error: 'Failed to fetch tasks' }
  }

  const lines = data
    .map((row: Record<string, unknown>) => {
      const task = row.tasks as { title: string; description: string | null } | null
      if (!task) return null
      if (task.description) {
        return `${task.title} — ${task.description}`
      }
      return task.title
    })
    .filter(Boolean)

  return { text: lines.join('\n') }
}

