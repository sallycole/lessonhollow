'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getEffectiveUser } from '@/lib/masquerade'
import { ACTION_TYPES, GRADE_LEVELS, type GradeLevel } from '@/lib/constants'
import { z } from 'zod'

const csvTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  action_type: z.enum(ACTION_TYPES),
  resource_url: z.string().optional(),
})

const csvDataSchema = z.object({
  curriculum: z.object({
    name: z.string().min(1, 'Curriculum name is required').max(200),
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

export type CsvActionState = {
  error?: string
}

export async function createCurriculumFromCsvAction(
  _prev: CsvActionState,
  formData: FormData
): Promise<CsvActionState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const rawJson = formData.get('csv_data') as string
  if (!rawJson) {
    return { error: 'No CSV data provided.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    return { error: 'Invalid data format.' }
  }

  const result = csvDataSchema.safeParse(parsed)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return { error: firstError?.message ?? 'Invalid CSV data.' }
  }

  const { curriculum: meta, tasks } = result.data

  // Create curriculum
  const { data: curriculum, error: currError } = await db.createCurriculum({
    user_id: effectiveUser.userId,
    name: meta.name,
    description: meta.description,
    resource_url: meta.resource_url,
    publisher: meta.publisher,
    grade_level: meta.grade_level as GradeLevel | undefined,
  })

  if (currError || !curriculum) {
    return { error: 'Failed to create curriculum. Please try again.' }
  }

  // Bulk create tasks with sequential positions
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
    // Clean up the curriculum since tasks failed
    await db.deleteCurriculum(curriculum.id as string)
    return { error: 'Failed to create tasks. Please try again.' }
  }

  revalidatePath('/curriculums')
  redirect(`/curriculums/${curriculum.id}`)
}
