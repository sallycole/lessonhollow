import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { getMasqueradeContext } from '@/lib/masquerade'
import { sortPlayersGuideFirst } from '@/lib/sort-players'
import { LowBalanceBanner } from './low-balance-banner'
import { getCreditAccount } from '@/lib/credits'
import Link from 'next/link'
import { ENROLLMENT_COST_CENTS } from '@/lib/pricing'
import {
  DashboardPlayerCard,
  DashboardWelcomeCard,
  type DashboardPlayerData,
  type EnrollmentRow,
} from '@/components/dashboard-player-card'
import {
  EnrollmentRequestsSection,
  type EnrollmentRequestData,
} from '@/components/enrollment-request-card'
import {
  computeQuantitativePacing,
  computePlayerPacingRollup,
  type PacingStatus,
} from '@/lib/daily-goal'
import { resolveTimeZone, todayInTimeZone } from '@/lib/date-tz'

async function getOnboardingState() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const empty = { showEmptyState: false, hasPlayers: false, userId: null as string | null, players: [] as any[] }

    if (!user) return empty

    const { data: players } = await db.getPlayersByGuide(user.id)
    const hasPlayers = (players?.length ?? 0) > 0

    const showEmptyState = !hasPlayers

    return { showEmptyState, hasPlayers, userId: user.id, players: players ?? [] }
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { showEmptyState: false, hasPlayers: false, userId: null as string | null, players: [] as any[] }
  }
}

async function shouldShowLowBalanceBanner(userId: string | null): Promise<boolean> {
  if (!userId) return false
  try {
    const acct = await getCreditAccount(userId)
    if (acct.balance_cents >= 300) return false
    // Show banner only if all of the guide's players have used their free enrollment
    const { data: players } = await db.getPlayersByGuide(userId)
    if (!players || players.length === 0) return false
    const hasFreeRemaining = players.some((p: { free_enrollment_used: boolean }) => !p.free_enrollment_used)
    return !hasFreeRemaining
  } catch {
    return false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildPlayerData(player: any): Promise<DashboardPlayerData> {
  const playerName = `${player.first_name} ${player.last_name}`
  const timeZone = resolveTimeZone(player.time_zone)
  const todayKey = todayInTimeZone(timeZone)

  // Fetch active enrollments
  const { data: enrollments } = await db.getActiveEnrollmentsWithCurricula(player.id)

  if (!enrollments || enrollments.length === 0) {
    // Empty-state player — fetch counts for guidance message
    const [currResult, enrollResult] = await Promise.all([
      player.auth_user_id
        ? db.getCurriculumCountByUser(player.auth_user_id)
        : Promise.resolve({ count: 0 }),
      db.getEnrollmentsByPlayer(player.id),
    ])

    return {
      playerId: player.id,
      playerName,
      timeZone,
      activeEnrollments: [],
      rollupStatus: 'ongoing',
      totalBehind: 0,
      curriculumCount: currResult.count ?? 0,
      enrollmentCount: enrollResult.data?.length ?? 0,
      isGuidePlayer: player.is_guide_player === true,
    }
  }

  // Fetch stats and completion dates for all enrollments in parallel
  const enrollmentIds = enrollments.map((e: { id: string }) => e.id)
  const [completionDatesResult, ...statsResults] = await Promise.all([
    db.getCompletionDatesByEnrollment(enrollmentIds),
    ...enrollments.map((e: { id: string }) => db.getEnrollmentStats(e.id, todayKey)),
  ])

  // Index completion dates and statuses by enrollment
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

  // Build enrollment rows with pacing
  const enrollmentRows: EnrollmentRow[] = []
  const pacingResults: { status: PacingStatus; tasksDelta: number }[] = []

  for (let i = 0; i < enrollments.length; i++) {
    const enrollment = enrollments[i] as {
      id: string
      enrollment_type: string
      target_completion_date: string | null
      target_loops: number | null
      start_date: string | null
      created_at: string
      curricula: { name: string } | null
    }
    const stats = statsResults[i]?.data as {
      totalTasks: number
      doneTasks: number
      percentComplete: number
      completedLoops?: number
    } | null

    if (!stats) continue

    // For memorization, totalRequired = taskCount * target_loops
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

    enrollmentRows.push({
      enrollmentId: enrollment.id,
      curriculumName: enrollment.curricula?.name ?? 'Untitled',
      completionPercent,
      status: pacing.status,
      tasksDelta: pacing.tasksDelta,
      completionDates: completionsByEnrollment.get(enrollment.id) ?? [],
      completionStatuses: statusesByEnrollment.get(enrollment.id) ?? [],
      startDate: enrollment.start_date ?? enrollment.created_at,
    })
  }

  // Sort enrollment rows: overdue → behind → on-track → ahead → ongoing
  const statusPriority: Record<PacingStatus, number> = {
    overdue: 0,
    behind: 1,
    'on-track': 2,
    ahead: 3,
    ongoing: 4,
  }
  enrollmentRows.sort((a, b) => {
    const p = statusPriority[a.status] - statusPriority[b.status]
    if (p !== 0) return p
    return a.tasksDelta - b.tasksDelta // more behind = higher priority
  })

  const rollup = computePlayerPacingRollup(pacingResults)

  return {
    playerId: player.id,
    playerName,
    timeZone,
    activeEnrollments: enrollmentRows,
    rollupStatus: rollup.status,
    totalBehind: rollup.totalBehind,
    isGuidePlayer: player.is_guide_player === true,
  }
}

export default async function DashboardPage() {
  // Redirect to /today if masquerade is active (guide viewing as player)
  const masquerade = await getMasqueradeContext()
  if (masquerade) redirect('/today')

  const { showEmptyState, userId, players } = await getOnboardingState()
  const showLowBalance = await shouldShowLowBalanceBanner(userId ?? null)

  // Credit summary line
  let creditSummary: { text: string; href: string } | null = null
  let balanceCents = 0
  if (userId) {
    try {
      const acct = await getCreditAccount(userId)
      balanceCents = acct.balance_cents
      const paidEnrollments = Math.floor(acct.balance_cents / ENROLLMENT_COST_CENTS)
      const freeRemaining = players.filter(
        (p: { free_enrollment_used: boolean }) => !p.free_enrollment_used
      ).length

      if (freeRemaining > 0 && paidEnrollments === 0) {
        creditSummary = {
          text: 'The first enrollment for each Player is free',
          href: '/pricing',
        }
      } else if (paidEnrollments > 0) {
        creditSummary = {
          text: `${paidEnrollments} enrollment credit${paidEnrollments !== 1 ? 's' : ''}`,
          href: '/credits',
        }
      } else {
        creditSummary = {
          text: 'No enrollment credits',
          href: '/credits',
        }
      }
    } catch {
      // Don't block the dashboard if credit lookup fails
    }
  }

  // Fetch pending enrollment requests for the guide
  let enrollmentRequests: EnrollmentRequestData[] = []
  if (userId) {
    const { data: pendingRequests } = await db.getPendingEnrollmentRequests(userId)
    if (pendingRequests && pendingRequests.length > 0) {
      enrollmentRequests = pendingRequests.map((req: {
        id: string
        enrollment_type: string
        study_days_per_week: number
        tasks_per_study_day: number
        target_completion_date: string | null
        target_loops: number | null
        created_at: string
        players: { first_name: string; last_name: string; free_enrollment_used: boolean } | null
        curricula: { name: string } | null
      }) => ({
        id: req.id,
        playerName: req.players ? `${req.players.first_name} ${req.players.last_name}` : 'Player',
        curriculumName: req.curricula?.name ?? 'Curriculum',
        enrollmentType: req.enrollment_type,
        studyDaysPerWeek: Number(req.study_days_per_week),
        tasksPerStudyDay: req.tasks_per_study_day,
        targetCompletionDate: req.target_completion_date,
        targetLoops: req.target_loops,
        isFreeEnrollment: !req.players?.free_enrollment_used,
        createdAt: req.created_at,
      }))
    }
  }

  // Sort players: guide-as-player at top, then alphabetical by first name.
  // This sort needs the raw player records (with first_name and the
  // is_guide_player flag) so it happens before buildPlayerData maps them.
  let playerCards: DashboardPlayerData[] = []
  if (players.length > 0 && userId) {
    const { sorted } = sortPlayersGuideFirst(players)
    playerCards = await Promise.all(
      sorted.map((player) => buildPlayerData(player))
    )
  }

  const totalCurriculums = playerCards.reduce(
    (sum, p) => sum + (p.curriculumCount ?? 0),
    0,
  )
  const isFirstTimeGuide = totalCurriculums === 0

  return (
    <>
      <hgroup>
        <h1>Dashboard</h1>
        <p>See player progress at a glance.</p>
      </hgroup>
      <div className="dashboard-shell">
        {creditSummary && !showLowBalance && (
          <p className="dashboard-credit-line">
            {creditSummary.text} ·{' '}
            <Link href={creditSummary.href}>
              {creditSummary.href === '/pricing'
                ? 'How enrollment credits work'
                : 'Manage credits'}
            </Link>
          </p>
        )}
        {showLowBalance && <LowBalanceBanner />}
        <EnrollmentRequestsSection
          requests={enrollmentRequests}
          balanceCents={balanceCents}
        />
        {showEmptyState && <DashboardWelcomeCard />}
        {playerCards.map((player) => (
          <DashboardPlayerCard
            key={player.playerId}
            player={player}
            isFirstTimeGuide={isFirstTimeGuide}
          />
        ))}
      </div>
    </>
  )
}
