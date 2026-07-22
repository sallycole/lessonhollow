import { describe, it, expect, vi, afterEach } from 'vitest'
import { calculateDailyGoal, DailyGoalInput, computeQuantitativePacing, computePlayerPacingRollup } from '../daily-goal'

const TODAY = '2026-03-15'

function makeInput(overrides: Partial<DailyGoalInput> = {}): DailyGoalInput {
  return {
    enrollmentType: 'core',
    totalTasks: 100,
    completedTasks: 0,
    targetCompletionDate: '2026-06-15', // ~92 days away
    studyDaysPerWeek: 5,
    ...overrides,
  }
}

describe('calculateDailyGoal', () => {
  describe('sequential enrollments (core/elective)', () => {
    it('calculates tasks per day for a core enrollment', () => {
      const result = calculateDailyGoal(
        makeInput({
          totalTasks: 100,
          completedTasks: 0,
          targetCompletionDate: '2026-04-14', // 30 days away
          studyDaysPerWeek: 5,
        }),
        TODAY
      )
      // 30 calendar days * (5/7) = ~21.43 study days
      // 100 tasks / 21.43 = 4.67 → ceil = 5
      expect(result).toEqual({ status: 'on_track', tasksPerDay: 5 })
    })

    it('calculates for an elective enrollment with partial completion', () => {
      const result = calculateDailyGoal(
        makeInput({
          enrollmentType: 'elective',
          totalTasks: 50,
          completedTasks: 20,
          targetCompletionDate: '2026-04-14', // 30 days
          studyDaysPerWeek: 7, // every day
        }),
        TODAY
      )
      // 30 remaining tasks / 30 study days = 1
      expect(result).toEqual({ status: 'on_track', tasksPerDay: 1 })
    })

    it('rounds up fractional tasks per day', () => {
      const result = calculateDailyGoal(
        makeInput({
          totalTasks: 10,
          completedTasks: 0,
          targetCompletionDate: '2026-04-14', // 30 days
          studyDaysPerWeek: 7,
        }),
        TODAY
      )
      // 10 / 30 = 0.33 → ceil = 1
      expect(result).toEqual({ status: 'on_track', tasksPerDay: 1 })
    })

    it('handles 0.5 study days per week', () => {
      const result = calculateDailyGoal(
        makeInput({
          totalTasks: 4,
          completedTasks: 0,
          targetCompletionDate: '2026-04-12', // 28 days
          studyDaysPerWeek: 0.5,
        }),
        TODAY
      )
      // 28 * (0.5/7) = 2 study days
      // 4 / 2 = 2
      expect(result).toEqual({ status: 'on_track', tasksPerDay: 2 })
    })
  })

  describe('memorization enrollments', () => {
    it('calculates based on total loops × tasks', () => {
      const result = calculateDailyGoal(
        makeInput({
          enrollmentType: 'memorization',
          totalTasks: 20,
          completedTasks: 0, // tasks completed in current loop
          targetCompletionDate: '2026-04-14', // 30 days
          studyDaysPerWeek: 5,
          targetLoops: 3,
          completedLoops: 0,
        }),
        TODAY
      )
      // Total work: 3 * 20 = 60 task completions
      // Study days: 30 * (5/7) ≈ 21.43
      // 60 / 21.43 ≈ 2.8 → ceil = 3
      expect(result).toEqual({ status: 'on_track', tasksPerDay: 3 })
    })

    it('accounts for completed loops', () => {
      const result = calculateDailyGoal(
        makeInput({
          enrollmentType: 'memorization',
          totalTasks: 10,
          completedTasks: 5, // 5 done in current loop
          targetCompletionDate: '2026-04-14', // 30 days
          studyDaysPerWeek: 7,
          targetLoops: 3,
          completedLoops: 1, // 1 full loop done
        }),
        TODAY
      )
      // Total: 3 * 10 = 30
      // Done: 1 * 10 + 5 = 15
      // Remaining: 15
      // Study days: 30
      // 15 / 30 = 0.5 → ceil = 1
      expect(result).toEqual({ status: 'on_track', tasksPerDay: 1 })
    })

    it('handles single-task curriculum with many loops', () => {
      const result = calculateDailyGoal(
        makeInput({
          enrollmentType: 'memorization',
          totalTasks: 1,
          completedTasks: 0,
          targetCompletionDate: '2026-03-22', // 7 days
          studyDaysPerWeek: 7,
          targetLoops: 10,
          completedLoops: 0,
        }),
        TODAY
      )
      // Total: 10 * 1 = 10
      // Study days: 7
      // 10 / 7 ≈ 1.43 → ceil = 2
      expect(result).toEqual({ status: 'on_track', tasksPerDay: 2 })
    })
  })

  describe('edge cases', () => {
    it('returns no_target for ongoing elective with null date', () => {
      const result = calculateDailyGoal(
        makeInput({
          enrollmentType: 'elective',
          targetCompletionDate: null,
        }),
        TODAY
      )
      expect(result).toEqual({ status: 'no_target' })
    })

    it('returns complete when all tasks are done', () => {
      const result = calculateDailyGoal(
        makeInput({
          totalTasks: 50,
          completedTasks: 50,
          targetCompletionDate: '2026-06-01',
        }),
        TODAY
      )
      expect(result).toEqual({ status: 'complete' })
    })

    it('returns complete for memorization when all loops done', () => {
      const result = calculateDailyGoal(
        makeInput({
          enrollmentType: 'memorization',
          totalTasks: 10,
          completedTasks: 0,
          targetCompletionDate: '2026-06-01',
          targetLoops: 3,
          completedLoops: 3,
        }),
        TODAY
      )
      expect(result).toEqual({ status: 'complete' })
    })

    it('returns overdue when target date has passed', () => {
      const result = calculateDailyGoal(
        makeInput({
          totalTasks: 20,
          completedTasks: 5,
          targetCompletionDate: '2026-03-10', // 5 days ago
        }),
        TODAY
      )
      expect(result).toEqual({ status: 'overdue', remainingTasks: 15 })
    })

    it('returns overdue when target date is today with remaining work', () => {
      const result = calculateDailyGoal(
        makeInput({
          totalTasks: 10,
          completedTasks: 5,
          targetCompletionDate: '2026-03-15', // today
        }),
        TODAY
      )
      expect(result).toEqual({ status: 'overdue', remainingTasks: 5 })
    })

    it('returns overdue for memorization when target has passed', () => {
      const result = calculateDailyGoal(
        makeInput({
          enrollmentType: 'memorization',
          totalTasks: 10,
          completedTasks: 3,
          targetCompletionDate: '2026-03-01',
          targetLoops: 2,
          completedLoops: 0,
        }),
        TODAY
      )
      // Remaining: 2*10 - 0*10 - 3 = 17
      expect(result).toEqual({ status: 'overdue', remainingTasks: 17 })
    })

    it('handles zero remaining tasks even when not all loops done (tasks completed > expected)', () => {
      const result = calculateDailyGoal(
        makeInput({
          enrollmentType: 'memorization',
          totalTasks: 5,
          completedTasks: 5, // all tasks in current loop done
          targetCompletionDate: '2026-06-01',
          targetLoops: 2,
          completedLoops: 1,
        }),
        TODAY
      )
      // Total: 2 * 5 = 10; Done: 1*5 + 5 = 10; Remaining: 0
      expect(result).toEqual({ status: 'complete' })
    })

    it('handles one day remaining (tomorrow is target)', () => {
      const result = calculateDailyGoal(
        makeInput({
          totalTasks: 3,
          completedTasks: 0,
          targetCompletionDate: '2026-03-16', // 1 day away
          studyDaysPerWeek: 7,
        }),
        TODAY
      )
      // 1 day * (7/7) = 1 study day
      // 3 / 1 = 3
      expect(result).toEqual({ status: 'on_track', tasksPerDay: 3 })
    })

    it('handles very low study days per week with near target', () => {
      const result = calculateDailyGoal(
        makeInput({
          totalTasks: 10,
          completedTasks: 0,
          targetCompletionDate: '2026-03-16', // 1 day
          studyDaysPerWeek: 0.5,
        }),
        TODAY
      )
      // 1 * (0.5/7) ≈ 0.071 study days
      // 10 / 0.071 ≈ 140 → ceil = 140
      expect(result).toEqual({ status: 'on_track', tasksPerDay: 140 })
    })
  })
})

describe('computeQuantitativePacing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockToday(dateStr: string) {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(dateStr + 'T12:00:00Z'))
  }

  it('returns ongoing when no target date', () => {
    const result = computeQuantitativePacing({
      completed: 5,
      total: 20,
      startDate: '2026-01-01',
      targetDate: null,
    })
    expect(result).toEqual({ status: 'ongoing', tasksDelta: 0 })
  })

  it('returns ongoing when total is 0', () => {
    const result = computeQuantitativePacing({
      completed: 0,
      total: 0,
      startDate: '2026-01-01',
      targetDate: '2026-06-01',
    })
    expect(result).toEqual({ status: 'ongoing', tasksDelta: 0 })
  })

  it('returns overdue when past target and incomplete', () => {
    mockToday('2026-04-01')
    const result = computeQuantitativePacing({
      completed: 5,
      total: 20,
      startDate: '2026-01-01',
      targetDate: '2026-03-15',
    })
    expect(result.status).toBe('overdue')
    expect(result.tasksDelta).toBe(-15) // 5 - 20
  })

  it('returns ahead when all done before target', () => {
    mockToday('2026-02-15')
    const result = computeQuantitativePacing({
      completed: 20,
      total: 20,
      startDate: '2026-01-01',
      targetDate: '2026-06-01',
    })
    expect(result.status).toBe('ahead')
  })

  it('returns on-track when all done after target', () => {
    mockToday('2026-07-01')
    const result = computeQuantitativePacing({
      completed: 20,
      total: 20,
      startDate: '2026-01-01',
      targetDate: '2026-06-01',
    })
    expect(result.status).toBe('on-track')
  })

  it('returns behind when fewer tasks completed than expected', () => {
    mockToday('2026-04-01') // ~halfway through Jan-Jun
    const result = computeQuantitativePacing({
      completed: 2,
      total: 20,
      startDate: '2026-01-01',
      targetDate: '2026-07-01', // 6 months
    })
    // ~halfway, expected ~10, completed 2 → behind
    expect(result.status).toBe('behind')
    expect(result.tasksDelta).toBeLessThan(0)
  })

  it('returns ahead when more tasks completed than expected', () => {
    mockToday('2026-02-01') // early in the timeline
    const result = computeQuantitativePacing({
      completed: 15,
      total: 20,
      startDate: '2026-01-01',
      targetDate: '2026-07-01',
    })
    expect(result.status).toBe('ahead')
    expect(result.tasksDelta).toBeGreaterThan(0)
  })

  it('returns on-track with zero delta when the start date is in the future', () => {
    mockToday('2026-07-13')
    const result = computeQuantitativePacing({
      completed: 0,
      total: 20,
      startDate: '2026-09-01',
      targetDate: '2027-06-01',
    })
    expect(result).toEqual({ status: 'on-track', tasksDelta: 0 })
  })

  it('returns ahead when work is completed before a future start date', () => {
    mockToday('2026-07-13')
    const result = computeQuantitativePacing({
      completed: 3,
      total: 20,
      startDate: '2026-09-01',
      targetDate: '2027-06-01',
    })
    expect(result).toEqual({ status: 'ahead', tasksDelta: 3 })
  })
})

describe('computePlayerPacingRollup', () => {
  it('returns ongoing for empty array', () => {
    const result = computePlayerPacingRollup([])
    expect(result).toEqual({ status: 'ongoing', totalBehind: 0 })
  })

  it('returns worst status across enrollments', () => {
    const result = computePlayerPacingRollup([
      { status: 'ahead', tasksDelta: 3 },
      { status: 'behind', tasksDelta: -5 },
      { status: 'on-track', tasksDelta: 0 },
    ])
    expect(result.status).toBe('behind')
    expect(result.totalBehind).toBe(5)
  })

  it('sums behind tasks from multiple enrollments', () => {
    const result = computePlayerPacingRollup([
      { status: 'behind', tasksDelta: -3 },
      { status: 'overdue', tasksDelta: -7 },
      { status: 'ahead', tasksDelta: 10 }, // ahead never offsets
    ])
    expect(result.status).toBe('overdue')
    expect(result.totalBehind).toBe(10) // 3 + 7
  })

  it('returns on-track when all are on-track', () => {
    const result = computePlayerPacingRollup([
      { status: 'on-track', tasksDelta: 0 },
      { status: 'on-track', tasksDelta: 0 },
    ])
    expect(result.status).toBe('on-track')
    expect(result.totalBehind).toBe(0)
  })

  it('overdue beats behind in priority', () => {
    const result = computePlayerPacingRollup([
      { status: 'behind', tasksDelta: -2 },
      { status: 'overdue', tasksDelta: -5 },
    ])
    expect(result.status).toBe('overdue')
  })
})
