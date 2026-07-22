import { calculateDailyGoal, type EnrollmentType } from './daily-goal'

/** A pending task available for selection */
export interface PendingTask {
  taskId: string
  taskTitle: string
  loopNumber: number
}

/** Enrollment context needed by the selection algorithm */
export interface EnrollmentContext {
  enrollmentId: string
  enrollmentType: EnrollmentType
  targetCompletionDate: string | null
  studyDaysPerWeek: number
  totalTasks: number
  completedTasks: number
  targetLoops?: number
  completedLoops?: number
  pendingTasks: PendingTask[]
  curriculumTitle: string
  /** Enrollment start date (YYYY-MM-DD). Future-dated enrollments are skipped by auto-select. */
  startDate?: string
}

/** A selected task ready for promotion */
export interface TaskSelection {
  enrollmentId: string
  taskId: string
  taskTitle: string
  loopNumber: number
}

/** Type priority weights: core > elective > memorization */
const TYPE_PRIORITY: Record<EnrollmentType, number> = {
  core: 3,
  elective: 2,
  memorization: 1,
}

/**
 * Calculate an urgency score for an enrollment.
 * Higher score = more urgently needs tasks assigned today.
 *
 * Score components:
 * - Type priority (core=3, elective=2, memorization=1) × 100
 * - Overdue bonus: +1000 (always gets tasks first)
 * - Behind-schedule factor: tasksPerDay normalized (higher = more urgent)
 * - No target: base priority only (lowest urgency within type)
 */
function enrollmentUrgency(enrollment: EnrollmentContext, today: string): number {
  const typePriority = TYPE_PRIORITY[enrollment.enrollmentType] * 100

  if (enrollment.pendingTasks.length === 0) {
    return -1 // No tasks to assign
  }

  const dailyGoal = calculateDailyGoal(
    {
      enrollmentType: enrollment.enrollmentType,
      totalTasks: enrollment.totalTasks,
      completedTasks: enrollment.completedTasks,
      targetCompletionDate: enrollment.targetCompletionDate,
      studyDaysPerWeek: enrollment.studyDaysPerWeek,
      targetLoops: enrollment.targetLoops,
      completedLoops: enrollment.completedLoops,
    },
    today
  )

  switch (dailyGoal.status) {
    case 'overdue':
      // Overdue enrollments get highest priority
      return typePriority + 1000 + dailyGoal.remainingTasks
    case 'on_track':
      // More tasks per day = more urgent
      return typePriority + dailyGoal.tasksPerDay * 10
    case 'no_target':
      // No deadline = lowest urgency, but still eligible
      return typePriority
    case 'complete':
      // All done, shouldn't have pending tasks but handle gracefully
      return -1
  }
}

/**
 * Calculate how many tasks each enrollment "needs" today.
 * Returns at least 1 for any enrollment with pending tasks.
 */
function enrollmentNeed(enrollment: EnrollmentContext, today: string): number {
  if (enrollment.pendingTasks.length === 0) return 0

  const dailyGoal = calculateDailyGoal(
    {
      enrollmentType: enrollment.enrollmentType,
      totalTasks: enrollment.totalTasks,
      completedTasks: enrollment.completedTasks,
      targetCompletionDate: enrollment.targetCompletionDate,
      studyDaysPerWeek: enrollment.studyDaysPerWeek,
      targetLoops: enrollment.targetLoops,
      completedLoops: enrollment.completedLoops,
    },
    today
  )

  switch (dailyGoal.status) {
    case 'overdue':
      // Overdue: need extra tasks, capped at what's available
      return Math.min(dailyGoal.remainingTasks, enrollment.pendingTasks.length)
    case 'on_track':
      return Math.min(dailyGoal.tasksPerDay, enrollment.pendingTasks.length)
    case 'no_target':
      // No deadline: just contribute 1 task
      return Math.min(1, enrollment.pendingTasks.length)
    case 'complete':
      return 0
  }
}

/**
 * Select tasks to populate Today using a deterministic algorithm.
 *
 * Strategy:
 * 1. Sort enrollments by urgency (core first, overdue first, higher daily goal first)
 * 2. First pass: give each enrollment its "needed" tasks (from daily goal)
 * 3. If under taskCount, do additional passes giving 1 task each in priority order
 * 4. Stop at taskCount
 *
 * @param enrollments - Active enrollments with their pending tasks
 * @param taskCount - Number of tasks to select (1-20)
 * @param today - Current date as ISO string (YYYY-MM-DD) for testability
 * @returns Ordered list of task selections
 */
export function selectTasks(
  enrollments: EnrollmentContext[],
  taskCount: number,
  today: string
): TaskSelection[] {
  // Filter to enrollments that have pending tasks and have started
  // (future start dates are excluded — nothing is expected before them)
  const eligible = enrollments.filter(
    (e) => e.pendingTasks.length > 0 && (!e.startDate || e.startDate <= today)
  )

  if (eligible.length === 0) return []

  // Sort by urgency (descending)
  const sorted = [...eligible].sort((a, b) => {
    const urgA = enrollmentUrgency(a, today)
    const urgB = enrollmentUrgency(b, today)
    if (urgB !== urgA) return urgB - urgA
    // Tie-break: alphabetical by curriculum title for stability
    return a.curriculumTitle.localeCompare(b.curriculumTitle)
  })

  const selections: TaskSelection[] = []
  // Track how many tasks we've taken from each enrollment
  const takenCount = new Map<string, number>()
  for (const e of sorted) {
    takenCount.set(e.enrollmentId, 0)
  }

  // First pass: give each enrollment its daily goal need
  for (const enrollment of sorted) {
    if (selections.length >= taskCount) break
    const need = enrollmentNeed(enrollment, today)
    const available = enrollment.pendingTasks.length
    const toTake = Math.min(need, available, taskCount - selections.length)

    for (let i = 0; i < toTake; i++) {
      selections.push({
        enrollmentId: enrollment.enrollmentId,
        taskId: enrollment.pendingTasks[i].taskId,
        taskTitle: enrollment.pendingTasks[i].taskTitle,
        loopNumber: enrollment.pendingTasks[i].loopNumber,
      })
    }
    takenCount.set(enrollment.enrollmentId, toTake)
  }

  // Second pass: fill remaining slots round-robin by priority
  while (selections.length < taskCount) {
    let addedAny = false
    for (const enrollment of sorted) {
      if (selections.length >= taskCount) break
      const taken = takenCount.get(enrollment.enrollmentId) ?? 0
      if (taken < enrollment.pendingTasks.length) {
        const task = enrollment.pendingTasks[taken]
        selections.push({
          enrollmentId: enrollment.enrollmentId,
          taskId: task.taskId,
          taskTitle: task.taskTitle,
          loopNumber: task.loopNumber,
        })
        takenCount.set(enrollment.enrollmentId, taken + 1)
        addedAny = true
      }
    }
    // No more tasks available from any enrollment
    if (!addedAny) break
  }

  return selections
}
