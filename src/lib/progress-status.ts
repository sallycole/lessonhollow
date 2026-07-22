/**
 * Pure function to calculate progress status for an enrollment.
 *
 * Compares actual progress against expected progress based on elapsed time
 * to determine if the learner is on track, ahead, behind, overdue, or complete.
 */

export type ProgressStatusResult =
  | { status: 'complete' }
  | { status: 'ahead'; pctComplete: number; pctExpected: number }
  | { status: 'on_track'; pctComplete: number; pctExpected: number }
  | { status: 'behind'; pctComplete: number; pctExpected: number }
  | { status: 'overdue'; pctComplete: number }
  | { status: 'no_target' }

export interface ProgressStatusInput {
  enrollmentType: 'core' | 'elective' | 'memorization'
  totalTasks: number
  completedTasks: number // core/elective: completed+skipped tasks; memorization: unused
  targetCompletionDate: string | null // ISO YYYY-MM-DD
  startDate: string // ISO YYYY-MM-DD (enrollment start_date; falls back to created_at)
  targetLoops?: number // memorization only
  completedLoops?: number // memorization only
  completedTasksInCurrentLoop?: number // memorization only: completed (non-skipped) in current loop
  effectiveTotalTasks?: number // memorization only: totalTasks - permanently skipped
}

/**
 * Calculate progress status for an enrollment.
 *
 * @param input enrollment parameters
 * @param today current date as ISO YYYY-MM-DD string (for testability)
 */
export function calculateProgressStatus(
  input: ProgressStatusInput,
  today: string
): ProgressStatusResult {
  const {
    enrollmentType,
    totalTasks,
    completedTasks,
    targetCompletionDate,
    startDate,
    targetLoops = 1,
    completedLoops = 0,
    completedTasksInCurrentLoop = 0,
    effectiveTotalTasks,
  } = input

  if (totalTasks === 0) {
    return { status: 'no_target' }
  }

  // Calculate effective progress (0 to 1)
  let pctComplete: number
  if (enrollmentType === 'memorization') {
    const effTasks = effectiveTotalTasks ?? totalTasks
    if (effTasks <= 0 || targetLoops <= 0) {
      return { status: 'complete' }
    }
    const fractionalLoop = effTasks > 0 ? completedTasksInCurrentLoop / effTasks : 0
    pctComplete = (completedLoops + fractionalLoop) / targetLoops
  } else {
    pctComplete = completedTasks / totalTasks
  }

  // All work done
  if (pctComplete >= 1) {
    return { status: 'complete' }
  }

  // No target date → can't determine on-track status
  if (!targetCompletionDate) {
    return { status: 'no_target' }
  }

  const todayParsed = parseDate(today)
  const startParsed = parseDate(startDate)
  const targetParsed = parseDate(targetCompletionDate)

  const totalDays = daysBetween(startParsed, targetParsed)
  const elapsedDays = daysBetween(startParsed, todayParsed)

  // Target date has passed and work not complete → overdue
  if (elapsedDays >= totalDays) {
    return { status: 'overdue', pctComplete: Math.round(pctComplete * 100) }
  }

  // Expected progress based on elapsed time (0 before the start date)
  const pctExpected = totalDays > 0 ? Math.max(0, elapsedDays) / totalDays : 0

  const pctCompleteRounded = Math.round(pctComplete * 100)
  const pctExpectedRounded = Math.round(pctExpected * 100)

  // Ahead: actual progress exceeds expected by 10+ percentage points
  if (pctComplete >= pctExpected + 0.10) {
    return { status: 'ahead', pctComplete: pctCompleteRounded, pctExpected: pctExpectedRounded }
  }

  // On track: actual progress >= expected (within 10pp margin)
  if (pctComplete >= pctExpected) {
    return { status: 'on_track', pctComplete: pctCompleteRounded, pctExpected: pctExpectedRounded }
  }

  // Behind: actual progress < expected
  return { status: 'behind', pctComplete: pctCompleteRounded, pctExpected: pctExpectedRounded }
}

function parseDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

function daysBetween(
  from: { year: number; month: number; day: number },
  to: { year: number; month: number; day: number }
): number {
  const fromMs = Date.UTC(from.year, from.month - 1, from.day)
  const toMs = Date.UTC(to.year, to.month - 1, to.day)
  return Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24))
}
