import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getEffectiveUser } from '@/lib/masquerade'
import { CurriculumDetails } from './curriculum-details'

export const dynamic = 'force-dynamic'

export default async function CurriculumDetailsPage({
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

  // Look up enrollment to show task completion status
  let playerId: string | undefined
  if (effectiveUser.isMasquerading && effectiveUser.playerId) {
    playerId = effectiveUser.playerId
  } else {
    const { data: player } = await db.getPlayerByAuthUserId(effectiveUser.userId)
    playerId = player?.id
  }

  let enrollmentId: string | undefined
  if (playerId) {
    const { data: enrollment } = await db.getEnrollmentByPlayerAndCurriculum(playerId, id)
    enrollmentId = enrollment?.id
  }

  // Fetch tasks — with player status if enrolled, plain otherwise
  let taskList: Array<{
    id: string
    title: string
    description: string | null
    action_type: string
    resource_url: string | null
    player_status?: 'pending' | 'completed' | 'skipped' | 'promoted'
  }>

  if (enrollmentId) {
    const { data: tasksWithStatus } = await db.getTasksWithPlayerStatus(enrollmentId)
    taskList = (tasksWithStatus ?? []).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      description: t.description as string | null,
      action_type: t.action_type as string,
      resource_url: t.resource_url as string | null,
      player_status: t.player_status,
    }))
  } else {
    const { data: tasks } = await db.getTasksByCurriculum(id)
    taskList = (tasks ?? []).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      description: t.description as string | null,
      action_type: t.action_type as string,
      resource_url: t.resource_url as string | null,
    }))
  }

  return (
    <CurriculumDetails
      curriculum={{
        id: curriculum.id as string,
        name: curriculum.name as string,
        description: curriculum.description as string | null,
        resource_url: curriculum.resource_url as string | null,
        publisher: curriculum.publisher as string | null,
        grade_level: curriculum.grade_level as string | null,
      }}
      tasks={taskList}
      isEnrolled={!!enrollmentId}
    />
  )
}
