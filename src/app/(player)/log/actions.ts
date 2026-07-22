'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getEffectiveUser, resolvePlayerContext } from '@/lib/masquerade'

export async function addSpontaneousEntry(input: {
  title: string
  description?: string
  action_type: 'Read' | 'Watch' | 'Listen' | 'Do'
  time_spent_minutes?: number
}): Promise<{ error?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const resolvedPlayerId = await resolvePlayerContext(effectiveUser)
  if (!resolvedPlayerId) {
    return { error: 'No player account found.' }
  }

  // Validate title
  const title = input.title?.trim()
  if (!title || title.length === 0) {
    return { error: 'Title is required.' }
  }
  if (title.length > 200) {
    return { error: 'Title must be 200 characters or less.' }
  }

  const description = input.description?.trim() || undefined
  if (description && description.length > 1000) {
    return { error: 'Description must be 1000 characters or less.' }
  }

  const timeSpent = input.time_spent_minutes ?? 0
  if (timeSpent < 0) {
    return { error: 'Time spent cannot be negative.' }
  }

  const { error } = await db.createSpontaneousEntry({
    player_id: resolvedPlayerId,
    title,
    description,
    action_type: input.action_type,
    time_spent_minutes: timeSpent > 0 ? timeSpent : undefined,
    started_at: new Date().toISOString(),
  })

  if (error) {
    return { error: 'Failed to log activity. Please try again.' }
  }

  revalidatePath('/log')
  return {}
}

async function resolvePlayerId(): Promise<string | null> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) return null
  return resolvePlayerContext(effectiveUser)
}

async function verifyItemOwnership(
  itemId: string,
  itemType: 'task' | 'spontaneous',
  playerId: string
): Promise<boolean> {
  if (itemType === 'task') {
    const { data: task } = await db.getPlayerTaskById(itemId)
    if (!task) return false
    // Verify via enrollment -> player
    const { data: enrollment } = await db.getEnrollmentById(task.enrollment_id)
    return enrollment?.player_id === playerId
  } else {
    const { data: entry } = await db.getSpontaneousEntryById(itemId)
    return entry?.player_id === playerId
  }
}

export async function updateFeedItemNotes(
  itemId: string,
  itemType: 'task' | 'spontaneous',
  notes: string | null
): Promise<{ error?: string }> {
  const playerId = await resolvePlayerId()
  if (!playerId) return { error: 'You must be logged in.' }

  const trimmed = notes?.trim() || null
  if (trimmed && trimmed.length > 2000) {
    return { error: 'Notes must be 2000 characters or less.' }
  }

  const owns = await verifyItemOwnership(itemId, itemType, playerId)
  if (!owns) return { error: 'Item not found.' }

  if (itemType === 'task') {
    const { error } = await db.updatePlayerTask(itemId, { notes: trimmed })
    if (error) return { error: 'Failed to update notes.' }
  } else {
    const { error } = await db.updateSpontaneousEntry(itemId, { notes: trimmed })
    if (error) return { error: 'Failed to update notes.' }
  }

  revalidatePath('/log')
  return {}
}

export async function updateFeedItemTime(
  itemId: string,
  itemType: 'task' | 'spontaneous',
  timeSpentMinutes: number
): Promise<{ error?: string }> {
  const playerId = await resolvePlayerId()
  if (!playerId) return { error: 'You must be logged in.' }

  if (!Number.isFinite(timeSpentMinutes) || timeSpentMinutes < 0 || timeSpentMinutes > 1440) {
    return { error: 'Time must be between 0 and 1440 minutes.' }
  }

  const owns = await verifyItemOwnership(itemId, itemType, playerId)
  if (!owns) return { error: 'Item not found.' }

  if (itemType === 'task') {
    const { error } = await db.updatePlayerTask(itemId, { time_spent_minutes: timeSpentMinutes })
    if (error) return { error: 'Failed to update time.' }
  } else {
    const { error } = await db.updateSpontaneousEntry(itemId, { time_spent_minutes: timeSpentMinutes })
    if (error) return { error: 'Failed to update time.' }
  }

  revalidatePath('/log')
  return {}
}

export async function updateFeedItemTimestamp(
  itemId: string,
  itemType: 'task' | 'spontaneous',
  timestamp: string
): Promise<{ error?: string }> {
  const playerId = await resolvePlayerId()
  if (!playerId) return { error: 'You must be logged in.' }

  const date = new Date(timestamp)
  if (isNaN(date.getTime())) {
    return { error: 'Invalid date.' }
  }

  // Cannot set date in the future
  if (date.getTime() > Date.now()) {
    return { error: 'Date cannot be in the future.' }
  }

  const owns = await verifyItemOwnership(itemId, itemType, playerId)
  if (!owns) return { error: 'Item not found.' }

  // For curriculum tasks, cannot set date before enrollment start
  if (itemType === 'task') {
    const { data: task } = await db.getPlayerTaskById(itemId)
    if (task?.enrollment_id) {
      const { data: enrollment } = await db.getEnrollmentById(task.enrollment_id)
      if (enrollment?.created_at) {
        const enrollmentStart = new Date(enrollment.created_at)
        if (date.getTime() < enrollmentStart.getTime()) {
          return { error: 'Date cannot be before the enrollment start date.' }
        }
      }
    }
  }

  const iso = date.toISOString()

  if (itemType === 'task') {
    const { error } = await db.updatePlayerTask(itemId, { completed_at: iso })
    if (error) return { error: 'Failed to update date.' }
  } else {
    const { error } = await db.updateSpontaneousEntry(itemId, { started_at: iso })
    if (error) return { error: 'Failed to update date.' }
  }

  revalidatePath('/log')
  return {}
}

export async function deleteLogEntry(
  itemId: string,
  itemType: 'task' | 'spontaneous'
): Promise<{ error?: string }> {
  const playerId = await resolvePlayerId()
  if (!playerId) return { error: 'You must be logged in.' }

  const owns = await verifyItemOwnership(itemId, itemType, playerId)
  if (!owns) return { error: 'Item not found.' }

  if (itemType === 'task') {
    const { error } = await db.deletePlayerTask(itemId)
    if (error) return { error: 'Failed to delete entry.' }
  } else {
    const { error } = await db.deleteSpontaneousEntry(itemId)
    if (error) return { error: 'Failed to delete entry.' }
  }

  revalidatePath('/log')
  revalidatePath('/today')
  revalidatePath('/progress')
  return {}
}

// Resets a curriculum task entry on the log: returns it to the Plan inventory
// rather than hard-deleting the player_task row, so the assignment survives
// and can be re-promoted. Spontaneous entries don't have a Plan to return to,
// so this rejects them; use deleteLogEntry for those.
export async function resetLogTask(
  itemId: string
): Promise<{ error?: string }> {
  const playerId = await resolvePlayerId()
  if (!playerId) return { error: 'You must be logged in.' }

  const owns = await verifyItemOwnership(itemId, 'task', playerId)
  if (!owns) return { error: 'Task not found.' }

  const { error } = await db.unfinishTask(itemId)
  if (error) return { error: 'Failed to reset task.' }

  revalidatePath('/log')
  revalidatePath('/today')
  revalidatePath('/plan')
  revalidatePath('/progress')
  return {}
}

