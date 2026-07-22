import { redirect } from 'next/navigation'
import { getEffectiveUser } from '@/lib/masquerade'
import { db } from '@/lib/db'
import { ProgressClient, type ProgressEnrollment } from './progress-client'
import { computeQuantitativePacing, computePlayerPacingRollup } from '@/lib/daily-goal'
import type { PacingStatus } from '@/lib/daily-goal'
import { resolveTimeZone, todayInTimeZone } from '@/lib/date-tz'

export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) redirect('/login')

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

  const timeZone = resolveTimeZone(playerTimeZone)
  const todayKey = todayInTimeZone(timeZone)

  const { data: enrollments } = await db.getEnrollmentsByPlayer(playerId)

  if (!enrollments || enrollments.length === 0) {
    return (
      <div className="progress-shell">
        <hgroup className="progress-header">
          <h1>Progress</h1>
          <p>Track your pacing across enrollments.</p>
        </hgroup>
        <ProgressClient enrollments={[]} rollupStatus="ongoing" totalBehind={0} timeZone={timeZone} />
      </div>
    )
  }

  const enrollmentIds = enrollments.map((e: { id: string }) => e.id)
  const [completionDatesResult, ...statsResults] = await Promise.all([
    db.getCompletionDatesByEnrollment(enrollmentIds),
    ...enrollments.map((e: { id: string }) => db.getEnrollmentStats(e.id, todayKey)),
  ])

  const completionsByEnrollment = new Map<string, string[]>()
  const statusesByEnrollment = new Map<string, string[]>()
  for (const row of (completionDatesResult.data ?? []) as { enrollment_id: string; completed_at: string; status: string }[]) {
    const dates = completionsByEnrollment.get(row.enrollment_id) ?? []
    dates.push(row.completed_at)
    completionsByEnrollment.set(row.enrollment_id, dates)
    const statuses = statusesByEnrollment.get(row.enrollment_id) ?? []
    statuses.push(row.status)
    statusesByEnrollment.set(row.enrollment_id, statuses)
  }

  const progressEnrollments: ProgressEnrollment[] = []
  const pacingResults: { status: PacingStatus; tasksDelta: number }[] = []

  for (let i = 0; i < enrollments.length; i++) {
    const enrollment = enrollments[i] as {
      id: string
      status: string
      enrollment_type: string
      target_completion_date: string | null
      target_loops: number | null
      start_date: string | null
      created_at: string
      curricula: { name: string; grade_level: string | null } | null
    }
    const stats = statsResults[i]?.data as {
      totalTasks: number
      doneTasks: number
      percentComplete: number
      completedLoops?: number
    } | null

    if (!stats) continue

    const targetLoops = enrollment.target_loops ?? 1
    const isMemo = enrollment.enrollment_type === 'memorization'
    const totalRequired = isMemo ? stats.totalTasks * targetLoops : stats.totalTasks
    const completedCount = isMemo
      ? (stats.completedLoops ?? 0) * stats.totalTasks + stats.doneTasks
      : stats.doneTasks

    const completionPercent = totalRequired > 0
      ? Math.round((completedCount / totalRequired) * 100)
      : 0

    const pacing = computeQuantitativePacing({
      completed: completedCount,
      total: totalRequired,
      startDate: (enrollment.start_date ?? enrollment.created_at).split('T')[0],
      targetDate: enrollment.target_completion_date,
      today: todayKey,
    })

    pacingResults.push(pacing)

    progressEnrollments.push({
      enrollmentId: enrollment.id,
      enrollmentStatus: enrollment.status as 'active' | 'paused' | 'finished',
      curriculumName: enrollment.curricula?.name ?? 'Untitled',
      gradeLevel: enrollment.curricula?.grade_level ?? null,
      enrollmentType: enrollment.enrollment_type as 'core' | 'elective' | 'memorization',
      completionPercent,
      status: pacing.status,
      tasksDelta: pacing.tasksDelta,
      completionDates: completionsByEnrollment.get(enrollment.id) ?? [],
      completionStatuses: statusesByEnrollment.get(enrollment.id) ?? [],
      startDate: enrollment.start_date ?? enrollment.created_at,
    })
  }

  const statusPriority: Record<PacingStatus, number> = {
    overdue: 0,
    behind: 1,
    'on-track': 2,
    ahead: 3,
    ongoing: 4,
  }
  progressEnrollments.sort((a, b) => {
    const p = statusPriority[a.status] - statusPriority[b.status]
    if (p !== 0) return p
    return a.tasksDelta - b.tasksDelta
  })

  const rollup = computePlayerPacingRollup(pacingResults)

  return (
    <div className="progress-shell">
      <hgroup className="progress-header">
        <h1>Progress</h1>
        <p>Track your pacing across enrollments.</p>
      </hgroup>
      <ProgressClient
        enrollments={progressEnrollments}
        rollupStatus={rollup.status}
        totalBehind={rollup.totalBehind}
        timeZone={timeZone}
      />
    </div>
  )
}
