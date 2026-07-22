import { redirect } from 'next/navigation'
import { getEffectiveUser } from '@/lib/masquerade'
import { db } from '@/lib/db'
import { resolveTimeZone, todayInTimeZone } from '@/lib/date-tz'
import { PromoteClient, type PromoteEnrollment } from './promote-client'

export const dynamic = 'force-dynamic'

export default async function PromotePage() {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) redirect('/login')

  // Resolve the player record
  let playerId: string | null = null
  let playerTimeZone: string | null = null

  if (effectiveUser.isMasquerading && effectiveUser.playerId) {
    playerId = effectiveUser.playerId
    const { data } = await db.getPlayerById(playerId)
    playerTimeZone = data?.time_zone ?? null
  } else {
    const { data } = await db.getPlayerByAuthUserId(effectiveUser.userId)
    if (data) {
      playerId = data.id
      playerTimeZone = data.time_zone ?? null
    }
  }

  if (!playerId) {
    redirect('/dashboard')
  }

  const todayKey = todayInTimeZone(resolveTimeZone(playerTimeZone))

  // Fetch active enrollments with curriculum data
  const { data: allEnrollmentsData } = await db.getEnrollmentsByPlayer(playerId)
  const activeRaw = (allEnrollmentsData ?? []).filter((e: Record<string, unknown>) => e.status === 'active')

  const enrollments: PromoteEnrollment[] = await Promise.all(
    activeRaw.map(async (e: Record<string, unknown>) => {
      const curricula = e.curricula as Record<string, unknown> | null
      const enrollmentId = e.id as string

      const [nextTaskResult, upcomingResult, statsResult] = await Promise.all([
        db.getNextPromotableTask(enrollmentId),
        db.getUpcomingTasks(enrollmentId, 5),
        db.getEnrollmentStats(enrollmentId, todayKey),
      ])

      const nextTask = nextTaskResult.data
      const upcoming = upcomingResult.data
      const stats = statsResult.data

      return {
        id: enrollmentId,
        curriculum_id: e.curriculum_id as string,
        curriculum_name: (curricula?.name as string) ?? 'Unknown Curriculum',
        enrollment_type: e.enrollment_type as 'core' | 'elective' | 'memorization',
        status: 'active' as const,
        start_date: (e.start_date as string) ?? '',
        next_task_title: nextTask?.taskTitle ?? null,
        current_loop: nextTask?.loopNumber ?? 1,
        upcoming_tasks: (upcoming ?? []).map((t) => ({
          task_id: t.taskId,
          title: t.taskTitle,
          description: t.taskDescription,
          resource_url: t.resourceUrl,
          action_type: t.actionType,
          status: t.status,
          loop_number: t.loopNumber,
        })),
        totalTasks: stats?.totalTasks ?? 0,
        completedTasks: stats?.doneTasks ?? 0,
        percentComplete: stats?.percentComplete ?? 0,
        progressStatus: stats?.progressStatus ?? { status: 'no_target' as const },
        completedLoops: stats?.completedLoops,
        targetLoops: stats?.targetLoops,
        completedTasksInCurrentLoop: stats?.completedTasksInCurrentLoop,
        effectiveTotalTasks: stats?.effectiveTotalTasks,
        grade_level: (curricula?.grade_level as string) ?? null,
      }
    })
  )

  return <PromoteClient enrollments={enrollments} todayKey={todayKey} />
}
