import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getEffectiveUser } from '@/lib/masquerade'
import { FinalizeClient } from './finalize-client'

export const dynamic = 'force-dynamic'

export default async function AddTasksPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) {
    notFound()
  }

  const { data: curriculum } = await db.getCurriculumById(id)
  if (!curriculum || curriculum.user_id !== effectiveUser.userId) {
    notFound()
  }

  const { data: tasks } = await db.getTasksByCurriculum(id)
  const taskList = (tasks ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    action_type: t.action_type as string,
    position: t.position as number,
  }))

  return (
    <FinalizeClient
      curriculum={{
        id: curriculum.id as string,
        name: curriculum.name as string,
        description: (curriculum.description as string) ?? null,
        resource_url: (curriculum.resource_url as string) ?? null,
        publisher: (curriculum.publisher as string) ?? null,
        grade_level: (curriculum.grade_level as string) ?? null,
      }}
      tasks={taskList}
    />
  )
}
