import { describe, it, expect } from 'vitest'
import { calculateProgressStatus, type ProgressStatusInput } from '../progress-status'

const TODAY = '2026-03-16'

function makeInput(overrides: Partial<ProgressStatusInput> = {}): ProgressStatusInput {
  return {
    enrollmentType: 'core',
    totalTasks: 20,
    completedTasks: 0,
    targetCompletionDate: '2026-06-01',
    startDate: '2026-01-01',
    ...overrides,
  }
}

describe('calculateProgressStatus', () => {
  describe('core/elective enrollments', () => {
    it('returns complete when all tasks done', () => {
      const result = calculateProgressStatus(
        makeInput({ completedTasks: 20 }),
        TODAY
      )
      expect(result).toEqual({ status: 'complete' })
    })

    it('returns no_target when no target date set', () => {
      const result = calculateProgressStatus(
        makeInput({ targetCompletionDate: null, completedTasks: 5 }),
        TODAY
      )
      expect(result).toEqual({ status: 'no_target' })
    })

    it('returns overdue when target date passed and work remains', () => {
      const result = calculateProgressStatus(
        makeInput({
          targetCompletionDate: '2026-03-01',
          completedTasks: 10,
        }),
        TODAY
      )
      expect(result.status).toBe('overdue')
      if (result.status === 'overdue') {
        expect(result.pctComplete).toBe(50)
      }
    })

    it('returns on_track when progress matches expected', () => {
      // Start: Jan 1, Target: Jun 1 (~151 days)
      // Today: Mar 16 (~74 days elapsed) → ~49% elapsed
      // 10/20 tasks = 50% done → on track
      const result = calculateProgressStatus(
        makeInput({ completedTasks: 10 }),
        TODAY
      )
      expect(result.status).toBe('on_track')
    })

    it('returns behind when progress is less than expected', () => {
      // ~49% elapsed, 3/20 = 15% done → behind
      const result = calculateProgressStatus(
        makeInput({ completedTasks: 3 }),
        TODAY
      )
      expect(result.status).toBe('behind')
      if (result.status === 'behind') {
        expect(result.pctComplete).toBe(15)
      }
    })

    it('returns ahead when progress significantly exceeds expected', () => {
      // ~49% elapsed, 16/20 = 80% done → ahead (>10pp over expected)
      const result = calculateProgressStatus(
        makeInput({ completedTasks: 16 }),
        TODAY
      )
      expect(result.status).toBe('ahead')
      if (result.status === 'ahead') {
        expect(result.pctComplete).toBe(80)
      }
    })

    it('handles elective type the same as core', () => {
      const result = calculateProgressStatus(
        makeInput({ enrollmentType: 'elective', completedTasks: 10 }),
        TODAY
      )
      expect(result.status).toBe('on_track')
    })

    it('returns no_target when totalTasks is 0', () => {
      const result = calculateProgressStatus(
        makeInput({ totalTasks: 0 }),
        TODAY
      )
      expect(result).toEqual({ status: 'no_target' })
    })

    it('returns overdue when target date is today and work remains', () => {
      const result = calculateProgressStatus(
        makeInput({ targetCompletionDate: TODAY, completedTasks: 5 }),
        TODAY
      )
      expect(result.status).toBe('overdue')
    })
  })

  describe('memorization enrollments', () => {
    function makeMemoInput(overrides: Partial<ProgressStatusInput> = {}): ProgressStatusInput {
      return {
        enrollmentType: 'memorization',
        totalTasks: 10,
        completedTasks: 0,
        targetCompletionDate: '2026-06-01',
        startDate: '2026-01-01',
        targetLoops: 5,
        completedLoops: 0,
        completedTasksInCurrentLoop: 0,
        effectiveTotalTasks: 10,
        ...overrides,
      }
    }

    it('returns complete when all loops done', () => {
      const result = calculateProgressStatus(
        makeMemoInput({ completedLoops: 5 }),
        TODAY
      )
      expect(result).toEqual({ status: 'complete' })
    })

    it('returns overdue when target date passed', () => {
      const result = calculateProgressStatus(
        makeMemoInput({
          targetCompletionDate: '2026-03-01',
          completedLoops: 2,
        }),
        TODAY
      )
      expect(result.status).toBe('overdue')
      if (result.status === 'overdue') {
        expect(result.pctComplete).toBe(40) // 2/5 = 40%
      }
    })

    it('includes fractional progress in current loop', () => {
      // 2 completed loops + 6/10 tasks in current loop = 2.6/5 = 52%
      // ~49% elapsed → on track (within 10pp)
      const result = calculateProgressStatus(
        makeMemoInput({
          completedLoops: 2,
          completedTasksInCurrentLoop: 6,
        }),
        TODAY
      )
      expect(result.status).toBe('on_track')
      if (result.status === 'on_track') {
        expect(result.pctComplete).toBe(52)
      }
    })

    it('returns behind when loop progress is insufficient', () => {
      // 1 completed loop + 0 in current = 1/5 = 20%
      // ~49% elapsed → behind
      const result = calculateProgressStatus(
        makeMemoInput({
          completedLoops: 1,
          completedTasksInCurrentLoop: 0,
        }),
        TODAY
      )
      expect(result.status).toBe('behind')
    })

    it('returns ahead when well ahead of schedule', () => {
      // 4 completed loops + 5/10 in current = 4.5/5 = 90%
      // ~49% elapsed → way ahead
      const result = calculateProgressStatus(
        makeMemoInput({
          completedLoops: 4,
          completedTasksInCurrentLoop: 5,
        }),
        TODAY
      )
      expect(result.status).toBe('ahead')
    })

    it('uses effectiveTotalTasks for fractional calculation', () => {
      // 10 total tasks, 2 skipped → 8 effective
      // 2 completed loops + 4/8 in current = 2.5/5 = 50%
      // ~49% elapsed → on track
      const result = calculateProgressStatus(
        makeMemoInput({
          effectiveTotalTasks: 8,
          completedLoops: 2,
          completedTasksInCurrentLoop: 4,
        }),
        TODAY
      )
      expect(result.status).toBe('on_track')
    })

    it('returns complete when all effective tasks are skipped', () => {
      const result = calculateProgressStatus(
        makeMemoInput({ effectiveTotalTasks: 0 }),
        TODAY
      )
      expect(result).toEqual({ status: 'complete' })
    })

    it('returns no_target when no target date for memorization', () => {
      const result = calculateProgressStatus(
        makeMemoInput({ targetCompletionDate: null, completedLoops: 2 }),
        TODAY
      )
      expect(result).toEqual({ status: 'no_target' })
    })
  })

  describe('edge cases', () => {
    it('returns on_track with 0% expected when the start date is in the future', () => {
      const result = calculateProgressStatus(
        makeInput({
          startDate: '2026-05-01',
          targetCompletionDate: '2026-12-01',
          completedTasks: 0,
        }),
        TODAY
      )
      expect(result.status).toBe('on_track')
      if (result.status === 'on_track') {
        expect(result.pctExpected).toBe(0)
      }
    })

    it('handles start date == today (just started)', () => {
      const result = calculateProgressStatus(
        makeInput({ startDate: TODAY, completedTasks: 0 }),
        TODAY
      )
      // 0% elapsed, 0% done → on track
      expect(result.status).toBe('on_track')
    })

    it('handles start date == target date (same day)', () => {
      const result = calculateProgressStatus(
        makeInput({
          startDate: TODAY,
          targetCompletionDate: TODAY,
          completedTasks: 5,
        }),
        TODAY
      )
      // Target date is today with remaining work → overdue
      expect(result.status).toBe('overdue')
    })

    it('more than 100% complete returns complete', () => {
      // 25/20 tasks somehow (shouldn't happen, but handle gracefully)
      const result = calculateProgressStatus(
        makeInput({ completedTasks: 25 }),
        TODAY
      )
      expect(result).toEqual({ status: 'complete' })
    })
  })
})
