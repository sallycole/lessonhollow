import { redirect } from 'next/navigation'
import { getEffectiveUser } from '@/lib/masquerade'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { resolveTimeZone, todayInTimeZone } from '@/lib/date-tz'
import { TodayClient, type TodayTask } from './today-client'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) redirect('/login')

  // Determine if the real logged-in user is a Guide (used for edit/remove UI)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isGuide = user?.user_metadata?.role !== 'player'

  // Resolve the player record
  let playerId: string | null = null
  let playerFirstName = ''
  let playerTimeZone: string | null = null

  if (effectiveUser.isMasquerading && effectiveUser.playerId) {
    playerId = effectiveUser.playerId
    const { data: player } = await db.getPlayerById(playerId)
    playerFirstName = player?.first_name ?? ''
    playerTimeZone = player?.time_zone ?? null
  } else {
    const { data: player } = await db.getPlayerByAuthUserId(effectiveUser.userId)
    if (player) {
      playerId = player.id
      playerFirstName = player.first_name ?? ''
      playerTimeZone = player.time_zone ?? null
    }
  }

  if (!playerId) {
    redirect('/dashboard')
  }

  // "Today" is the player's local calendar day, not the server's UTC day.
  const timeZone = resolveTimeZone(playerTimeZone)
  const todayDate = todayInTimeZone(timeZone)
  // Fetch promoted tasks, today's completed tasks, and active enrollments in parallel
  const [promotedResult, completedResult, enrollmentsResult] = await Promise.all([
    db.getPromotedTasksForToday(playerId),
    db.getCompletedTasksToday(playerId, todayDate, timeZone),
    db.getActiveEnrollmentsWithCurricula(playerId),
  ])

  const promotedTasks: TodayTask[] = (promotedResult.data ?? []).map(
    (pt: Record<string, unknown>) => {
      const task = pt.tasks as Record<string, unknown> | null
      const enrollment = pt.enrollments as Record<string, unknown> | null
      const curriculum = enrollment?.curricula as Record<string, unknown> | null
      return {
        id: pt.id as string,
        taskId: pt.task_id as string,
        enrollmentId: pt.enrollment_id as string,
        curriculumId: (curriculum?.id as string) ?? '',
        title: (task?.title as string) ?? '',
        description: (task?.description as string) ?? null,
        actionType: (task?.action_type as string) ?? 'Do',
        resourceUrl: (task?.resource_url as string) ?? null,
        curriculumName: (curriculum?.name as string) ?? 'Unknown',
        status: 'promoted' as const,
        timeSpentMinutes: (pt.time_spent_minutes as number) ?? null,
        promotedAt: pt.promoted_at as string,
        displayOrder: pt.display_order as number | null,
        timerStartedAt: (pt.timer_started_at as string) ?? null,
        accumulatedSeconds: (pt.accumulated_seconds as number) ?? 0,
        startedAt: (pt.started_at as string) ?? null,
      }
    }
  )

  const completedTasks: TodayTask[] = (completedResult.data ?? []).map(
    (pt: Record<string, unknown>) => {
      const task = pt.tasks as Record<string, unknown> | null
      const enrollment = pt.enrollments as Record<string, unknown> | null
      const curriculum = enrollment?.curricula as Record<string, unknown> | null
      return {
        id: pt.id as string,
        taskId: pt.task_id as string,
        enrollmentId: pt.enrollment_id as string,
        curriculumId: (curriculum?.id as string) ?? '',
        title: (task?.title as string) ?? '',
        description: (task?.description as string) ?? null,
        actionType: (task?.action_type as string) ?? 'Do',
        resourceUrl: (task?.resource_url as string) ?? null,
        curriculumName: (curriculum?.name as string) ?? 'Unknown',
        status: 'completed' as const,
        timeSpentMinutes: (pt.time_spent_minutes as number) ?? null,
        promotedAt: pt.promoted_at as string,
        displayOrder: pt.display_order as number | null,
        timerStartedAt: null,
        accumulatedSeconds: (pt.accumulated_seconds as number) ?? 0,
        startedAt: (pt.started_at as string) ?? null,
      }
    }
  )

  // Merge all tasks and sort by display_order (if set) then promoted_at ascending.
  // Completed tasks stay in position — they are not moved to the end.
  const allTasks = [...promotedTasks, ...completedTasks].sort((a, b) => {
    // If both have display_order, sort by that
    if (a.displayOrder != null && b.displayOrder != null) {
      return a.displayOrder - b.displayOrder
    }
    // display_order takes precedence over no display_order
    if (a.displayOrder != null) return -1
    if (b.displayOrder != null) return 1
    // Fall back to promoted_at ascending
    return new Date(a.promotedAt).getTime() - new Date(b.promotedAt).getTime()
  })

  const hasActiveEnrollments = (enrollmentsResult.data ?? []).length > 0

  return (
    <TodayClient
      tasks={allTasks}
      playerFirstName={playerFirstName}
      hasActiveEnrollments={hasActiveEnrollments}
      isGuide={isGuide}
    />
  )
}
