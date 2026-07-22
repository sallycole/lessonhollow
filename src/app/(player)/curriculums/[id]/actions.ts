'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getEffectiveUser } from '@/lib/masquerade'
import { GRADE_LEVELS, ACTION_TYPES, type GradeLevel } from '@/lib/constants'
import { z } from 'zod'

const urlSchema = z.string().url('Must be a valid URL')

const updateCurriculumSchema = z.object({
  name: z
    .string()
    .min(1, 'Curriculum name is required')
    .max(200, 'Name must be 200 characters or fewer'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer').optional(),
  resource_url: z
    .string()
    .optional()
    .refine(
      (val) => !val || urlSchema.safeParse(val).success,
      'Must be a valid URL (e.g. https://example.com)'
    ),
  publisher: z.string().max(200, 'Publisher must be 200 characters or fewer').optional(),
  grade_level: z
    .string()
    .optional()
    .refine(
      (val) => !val || (GRADE_LEVELS as readonly string[]).includes(val),
      'Invalid grade level'
    ),
})

export type UpdateCurriculumState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

export async function updateCurriculumAction(
  curriculumId: string,
  _prev: UpdateCurriculumState,
  formData: FormData
): Promise<UpdateCurriculumState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  // Verify ownership
  const { data: curriculum } = await db.getCurriculumById(curriculumId)
  if (!curriculum || curriculum.user_id !== effectiveUser.userId) {
    return { error: 'Curriculum not found.' }
  }

  const raw = {
    name: (formData.get('name') as string)?.trim(),
    description: (formData.get('description') as string)?.trim() || undefined,
    resource_url: (formData.get('resource_url') as string)?.trim() || undefined,
    publisher: (formData.get('publisher') as string)?.trim() || undefined,
    grade_level: (formData.get('grade_level') as string) || undefined,
  }

  const result = updateCurriculumSchema.safeParse(raw)
  if (!result.success) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = result.data

  const { error: dbError } = await db.updateCurriculum(curriculumId, {
    name: data.name,
    description: data.description ?? '',
    resource_url: data.resource_url ?? '',
    publisher: data.publisher ?? '',
    grade_level: (data.grade_level || null) as GradeLevel | null,
  })

  if (dbError) {
    return { error: 'Failed to update curriculum. Please try again.' }
  }

  revalidatePath(`/curriculums/${curriculumId}`)
  return { success: true }
}

// --- Task Editing ---

const updateTaskSchema = z.object({
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

export type UpdateTaskState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

// --- Delete Curriculum ---

export type DeleteCurriculumState = {
  error?: string
  success?: boolean
}

export async function deleteCurriculumAction(
  curriculumId: string,
  _prev: DeleteCurriculumState,
  _formData: FormData
): Promise<DeleteCurriculumState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  // Verify ownership
  const { data: curriculum } = await db.getCurriculumById(curriculumId)
  if (!curriculum || curriculum.user_id !== effectiveUser.userId) {
    return { error: 'Curriculum not found.' }
  }

  const { error: dbError } = await db.deleteCurriculum(curriculumId)
  if (dbError) {
    return { error: 'Failed to delete curriculum. Please try again.' }
  }

  redirect('/curriculums')
}

export async function updateTaskAction(
  taskId: string,
  curriculumId: string,
  _prev: UpdateTaskState,
  formData: FormData
): Promise<UpdateTaskState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  // Verify curriculum ownership
  const { data: curriculum } = await db.getCurriculumById(curriculumId)
  if (!curriculum || curriculum.user_id !== effectiveUser.userId) {
    return { error: 'Curriculum not found.' }
  }

  // Verify task belongs to this curriculum
  const { data: task } = await db.getTaskById(taskId)
  if (!task || task.curriculum_id !== curriculumId) {
    return { error: 'Task not found.' }
  }

  const raw = {
    title: (formData.get('title') as string)?.trim(),
    description: (formData.get('description') as string)?.trim() || undefined,
    action_type: formData.get('action_type') as string,
    resource_url: (formData.get('resource_url') as string)?.trim() || undefined,
  }

  const result = updateTaskSchema.safeParse(raw)
  if (!result.success) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = result.data

  const { error: dbError } = await db.updateTask(taskId, {
    title: data.title,
    description: data.description ?? '',
    action_type: data.action_type,
    resource_url: data.resource_url ?? '',
  })

  if (dbError) {
    return { error: 'Failed to update task. Please try again.' }
  }

  revalidatePath(`/curriculums/${curriculumId}`)
  return { success: true }
}

export async function deleteTaskAction(
  taskId: string,
  curriculumId: string
): Promise<{ error?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const { data: curriculum } = await db.getCurriculumById(curriculumId)
  if (!curriculum || curriculum.user_id !== effectiveUser.userId) {
    return { error: 'Curriculum not found.' }
  }

  const { data: task } = await db.getTaskById(taskId)
  if (!task || task.curriculum_id !== curriculumId) {
    return { error: 'Task not found.' }
  }

  const { error: dbError } = await db.deleteTask(taskId)
  if (dbError) {
    return { error: 'Failed to delete task. Please try again.' }
  }

  revalidatePath(`/curriculums/${curriculumId}`)
  return {}
}
