'use server'

import { db } from '@/lib/db'

export type DotTaskDetail = {
  title: string
  description: string | null
  actionType: string | null
  resourceUrl: string | null
  timeMinutes: number
  status: string
  completedAt: string | null
  notes: string | null
}

export async function getTasksForDotAction(
  enrollmentId: string,
  dateStr: string
): Promise<{ tasks: DotTaskDetail[]; error?: string }> {
  const { data, error } = await db.getCompletedTasksForEnrollmentOnDate(enrollmentId, dateStr)

  if (error || !data) {
    return { tasks: [], error: 'Failed to fetch tasks' }
  }

  const tasks: DotTaskDetail[] = (data as Record<string, unknown>[]).map((row) => {
    const task = row.tasks as { title: string; description: string | null; action_type: string | null; resource_url: string | null } | null
    return {
      title: task?.title ?? 'Untitled',
      description: task?.description ?? null,
      actionType: task?.action_type ?? null,
      resourceUrl: task?.resource_url ?? null,
      timeMinutes: (row.time_spent_minutes as number) ?? 0,
      status: row.status as string,
      completedAt: (row.completed_at as string) ?? null,
      notes: (row.notes as string) ?? null,
    }
  })

  return { tasks }
}
