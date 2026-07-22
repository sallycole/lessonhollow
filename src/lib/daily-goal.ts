export type EnrollmentType = 'core' | 'elective' | 'memorization'

export interface DailyGoalInput {
  enrollmentType: EnrollmentType
  totalTasks: number
  completedTasks: number
  targetCompletionDate: string | null // ISO date string (YYYY-MM-DD)
  studyDaysPerWeek: number // 0.5 to 7 in 0.5 increments
  targetLoops?: number // only for memorization
  completedLoops?: number // only for memorization
}

export type DailyGoalResult =
  | { status: 'on_track'; tasksPerDay: number }
  | { status: 'overdue'; remainingTasks: number }
  | { status: 'complete' }
  | { status: 'no_target' } // ongoing elective with no deadline

/**
 * Calculate the daily goal for an enrollment.
 *
 * For sequential types (core/elective): remaining tasks / remaining study days, rounded up.
 * For memorization: remaining task completions across loops / remaining study days, rounded up.
 * Returns overdue status if the target date has passed.
 * Returns no_target for ongoing enrollments with no deadline.
 * Returns complete if all work is done.
 *
 * @param input enrollment parameters
 * @param today current date as ISO string (YYYY-MM-DD), for testability
 */
export function calculateDailyGoal(
  input: DailyGoalInput,
  today: string
): DailyGoalResult {
  const {
    enrollmentType,
    totalTasks,
    completedTasks,
    targetCompletionDate,
    studyDaysPerWeek,
    targetLoops = 1,
    completedLoops = 0,
  } = input

  // No target date = ongoing, no daily goal
  if (!targetCompletionDate) {
    return { status: 'no_target' }
  }

  // Calculate remaining work
  let remainingWork: number
  if (enrollmentType === 'memorization') {
    const totalTaskCompletions = targetLoops * totalTasks
    const completedTaskCompletions = completedLoops * totalTasks + completedTasks
    remainingWork = totalTaskCompletions - completedTaskCompletions
  } else {
    // core or elective (sequential)
    remainingWork = totalTasks - completedTasks
  }

  // All work done
  if (remainingWork <= 0) {
    return { status: 'complete' }
  }

  // Calculate remaining calendar days
  const todayDate = parseDate(today)
  const targetDate = parseDate(targetCompletionDate)
  const calendarDaysRemaining = daysBetween(todayDate, targetDate)

  // Target date has passed (or is today with work remaining)
  if (calendarDaysRemaining <= 0) {
    return { status: 'overdue', remainingTasks: remainingWork }
  }

  // Convert calendar days to study days
  const remainingStudyDays = calendarDaysRemaining * (studyDaysPerWeek / 7)

  // Edge case: study days rounds to ~0
  if (remainingStudyDays < 0.01) {
    return { status: 'overdue', remainingTasks: remainingWork }
  }

  const tasksPerDay = Math.ceil(remainingWork / remainingStudyDays)

  return { status: 'on_track', tasksPerDay }
}

// --- Pacing computation for guide dashboard ---

export type PacingStatus = 'on-track' | 'behind' | 'ahead' | 'overdue' | 'ongoing'

export interface PacingResult {
  status: PacingStatus
  tasksDelta: number
}

/**
 * Compute quantitative pacing for a single enrollment.
 * Pure function — no DB access.
 */
export function computeQuantitativePacing({
  completed,
  total,
  startDate,
  targetDate,
  today: todayKey,
}: {
  completed: number
  total: number
  startDate: string // ISO date
  targetDate: string | null // ISO date or null
  today?: string // player-local YYYY-MM-DD; defaults to server (UTC) today
}): PacingResult {
  // No target date → ongoing
  if (!targetDate || total === 0) {
    return { status: 'ongoing', tasksDelta: 0 }
  }

  // Compare all dates at local midnight so a partial day never tips the
  // boundary; `todayKey` lets the caller pass the player-local day.
  const today = new Date(
    (todayKey ?? new Date().toISOString().split('T')[0]) + 'T00:00:00'
  )
  const target = new Date(targetDate + 'T00:00:00')

  // All done
  if (completed >= total) {
    return {
      status: today <= target ? 'ahead' : 'on-track',
      tasksDelta: completed - total,
    }
  }

  // Past target date and incomplete
  if (today > target) {
    return { status: 'overdue', tasksDelta: completed - total }
  }

  // Compute expected progress
  const start = new Date(startDate + 'T00:00:00')

  // Enrollment hasn't started yet → nothing is expected
  if (today < start) {
    return completed > 0
      ? { status: 'ahead', tasksDelta: completed }
      : { status: 'on-track', tasksDelta: 0 }
  }

  const totalDuration = target.getTime() - start.getTime()
  const elapsed = today.getTime() - start.getTime()

  if (totalDuration <= 0) {
    return { status: 'overdue', tasksDelta: completed - total }
  }

  const expectedCompleted = Math.round((elapsed / totalDuration) * total)
  const delta = completed - expectedCompleted

  if (delta > 0) return { status: 'ahead', tasksDelta: delta }
  if (delta < 0) return { status: 'behind', tasksDelta: delta }
  return { status: 'on-track', tasksDelta: 0 }
}

/**
 * Compute the worst-case pacing rollup across all enrollments for a player.
 */
export function computePlayerPacingRollup(
  pacingResults: PacingResult[]
): { status: PacingStatus; totalBehind: number } {
  if (pacingResults.length === 0) {
    return { status: 'ongoing', totalBehind: 0 }
  }

  const priority: Record<PacingStatus, number> = {
    overdue: 0,
    behind: 1,
    'on-track': 2,
    ahead: 3,
    ongoing: 4,
  }

  let worstStatus: PacingStatus = 'ongoing'
  let totalBehind = 0

  for (const r of pacingResults) {
    if (priority[r.status] < priority[worstStatus]) {
      worstStatus = r.status
    }
    if (r.status === 'behind' || r.status === 'overdue') {
      totalBehind += Math.abs(r.tasksDelta)
    }
  }

  return { status: worstStatus, totalBehind }
}

/** Parse YYYY-MM-DD into { year, month, day } to avoid timezone issues with Date */
function parseDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

/** Calculate the number of days between two dates (target - from). */
function daysBetween(
  from: { year: number; month: number; day: number },
  to: { year: number; month: number; day: number }
): number {
  const fromMs = Date.UTC(from.year, from.month - 1, from.day)
  const toMs = Date.UTC(to.year, to.month - 1, to.day)
  return Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24))
}
