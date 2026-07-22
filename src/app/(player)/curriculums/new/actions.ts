'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getEffectiveUser } from '@/lib/masquerade'
import { GRADE_LEVELS, type GradeLevel } from '@/lib/constants'
import { z } from 'zod'

const urlSchema = z.string().url('Must be a valid URL')

const createCurriculumSchema = z.object({
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

export type CurriculumActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function createCurriculumAction(
  _prev: CurriculumActionState,
  formData: FormData
): Promise<CurriculumActionState> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    return { error: 'You must be logged in.' }
  }

  const raw = {
    name: (formData.get('name') as string)?.trim(),
    description: (formData.get('description') as string)?.trim() || undefined,
    resource_url: (formData.get('resource_url') as string)?.trim() || undefined,
    publisher: (formData.get('publisher') as string)?.trim() || undefined,
    grade_level: (formData.get('grade_level') as string) || undefined,
  }

  const result = createCurriculumSchema.safeParse(raw)
  if (!result.success) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = result.data

  const { data: curriculum, error: dbError } = await db.createCurriculum({
    user_id: effectiveUser.userId,
    name: data.name,
    description: data.description,
    resource_url: data.resource_url,
    publisher: data.publisher,
    grade_level: data.grade_level as GradeLevel | undefined,
  })

  if (dbError || !curriculum) {
    return { error: 'Failed to create curriculum. Please try again.' }
  }

  revalidatePath('/curriculums')
  redirect(`/curriculums/${curriculum.id}`)
}
