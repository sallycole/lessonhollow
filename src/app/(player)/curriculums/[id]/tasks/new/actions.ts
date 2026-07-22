'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getEffectiveUser } from '@/lib/masquerade'
import { ACTION_TYPES } from '@/lib/constants'
import { z } from 'zod'

const urlSchema = z.string().url('Must be a valid URL')

const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(500, 'Title must be 500 characters or fewer'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer').optional(),
  action_type: z.enum(ACTION_TYPES, { message: 'Action type is required' }),
  resource_url: z
    .string()
    .optional()
    .refine(
      (val) => !val || urlSchema.safeParse(val).success,
      'Must be a valid URL (e.g. https://example.com)'
    ),
})

export type TaskActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  taskTitle?: string
  successCount?: number
}

export async function createTaskAction(
  curriculumId: string,
  _prev: TaskActionState,
  formData: FormData
): Promise<TaskActionState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  // Verify the curriculum belongs to this user
  const { data: curriculum } = await db.getCurriculumById(curriculumId)
  if (!curriculum || curriculum.user_id !== effectiveUser.userId) {
    return { error: 'Curriculum not found.' }
  }

  const raw = {
    title: (formData.get('title') as string)?.trim(),
    description: (formData.get('description') as string)?.trim() || undefined,
    action_type: formData.get('action_type') as string,
    resource_url: (formData.get('resource_url') as string)?.trim() || undefined,
  }

  const result = createTaskSchema.safeParse(raw)
  if (!result.success) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = result.data

  // Determine insertion position
  const insertAfter = (formData.get('insert_after') as string) || 'end'
  let insertPosition: number

  if (insertAfter === 'end') {
    // Append to end (default behavior)
    const maxPosition = await db.getMaxTaskPosition(curriculumId)
    insertPosition = maxPosition + 10
  } else if (insertAfter === 'beginning') {
    // Insert at beginning: shift all tasks forward, then insert at position 10
    await db.shiftTaskPositionsAfter(curriculumId, 0)
    insertPosition = 10
  } else {
    // Insert after a specific task: find that task's position
    const { data: afterTask } = await db.getTaskById(insertAfter)
    if (!afterTask || afterTask.curriculum_id !== curriculumId) {
      return { error: 'Selected insertion point not found.' }
    }
    const afterPosition = afterTask.position as number
    // Shift all tasks after the insertion point forward by 10
    await db.shiftTaskPositionsAfter(curriculumId, afterPosition)
    insertPosition = afterPosition + 10
  }

  const { error: dbError } = await db.createTask({
    curriculum_id: curriculumId,
    title: data.title,
    description: data.description,
    action_type: data.action_type,
    resource_url: data.resource_url,
    position: insertPosition,
  })

  if (dbError) {
    return { error: 'Failed to add task. Please try again.' }
  }

  revalidatePath(`/curriculums/${curriculumId}`)
  return { success: true, taskTitle: data.title, successCount: (_prev.successCount ?? 0) + 1 }
}

const reorderSchema = z.array(
  z.object({
    id: z.string().uuid(),
    position: z.number().int().min(0),
  })
)

export async function reorderTasksAction(
  curriculumId: string,
  updates: Array<{ id: string; position: number }>
): Promise<{ error?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const { data: curriculum } = await db.getCurriculumById(curriculumId)
  if (!curriculum || curriculum.user_id !== effectiveUser.userId) {
    return { error: 'Curriculum not found.' }
  }

  const parsed = reorderSchema.safeParse(updates)
  if (!parsed.success) {
    return { error: 'Invalid reorder data.' }
  }

  const { error: dbError } = await db.updateTaskPositions(parsed.data)
  if (dbError) {
    return { error: 'Failed to save task order.' }
  }

  revalidatePath(`/curriculums/${curriculumId}`)
  return {}
}
