import { describe, it, expect } from 'vitest'
import { selectTasks, EnrollmentContext } from '../task-selector'

const TODAY = '2026-03-15'

function makePendingTasks(count: number, prefix = 'task'): EnrollmentContext['pendingTasks'] {
  return Array.from({ length: count }, (_, i) => ({
    taskId: `${prefix}-${i + 1}`,
    taskTitle: `${prefix} ${i + 1}`,
    loopNumber: 1,
  }))
}

function makeEnrollment(overrides: Partial<EnrollmentContext> = {}): EnrollmentContext {
  return {
    enrollmentId: 'enroll-1',
    enrollmentType: 'core',
    targetCompletionDate: '2026-04-14', // 30 days from TODAY
    studyDaysPerWeek: 5,
    totalTasks: 20,
    completedTasks: 0,
    pendingTasks: makePendingTasks(20),
    curriculumTitle: 'Test Curriculum',
    ...overrides,
  }
}

describe('selectTasks', () => {
  describe('basic selection', () => {
    it('returns empty array when no enrollments', () => {
      expect(selectTasks([], 5, TODAY)).toEqual([])
    })

    it('returns empty array when all enrollments have no pending tasks', () => {
      const enrollment = makeEnrollment({ pendingTasks: [] })
      expect(selectTasks([enrollment], 5, TODAY)).toEqual([])
    })

    it('selects tasks up to the requested count', () => {
      const enrollment = makeEnrollment({ pendingTasks: makePendingTasks(10) })
      const result = selectTasks([enrollment], 5, TODAY)
      expect(result).toHaveLength(5)
    })

    it('returns fewer tasks if not enough pending', () => {
      const enrollment = makeEnrollment({ pendingTasks: makePendingTasks(3) })
      const result = selectTasks([enrollment], 10, TODAY)
      expect(result).toHaveLength(3)
    })

    it('selects tasks in position order from a single enrollment', () => {
      const enrollment = makeEnrollment({ pendingTasks: makePendingTasks(5) })
      const result = selectTasks([enrollment], 3, TODAY)
      expect(result.map((t) => t.taskId)).toEqual(['task-1', 'task-2', 'task-3'])
    })
  })

  describe('type priority: core > elective > memorization', () => {
    it('prioritizes core over elective', () => {
      const core = makeEnrollment({
        enrollmentId: 'core-1',
        enrollmentType: 'core',
        pendingTasks: makePendingTasks(5, 'core'),
        curriculumTitle: 'Core Curriculum',
      })
      const elective = makeEnrollment({
        enrollmentId: 'elec-1',
        enrollmentType: 'elective',
        pendingTasks: makePendingTasks(5, 'elec'),
        curriculumTitle: 'Elective Curriculum',
      })
      const result = selectTasks([elective, core], 3, TODAY)
      // Core should get tasks first
      const coreTaskCount = result.filter((t) => t.enrollmentId === 'core-1').length
      const elecTaskCount = result.filter((t) => t.enrollmentId === 'elec-1').length
      expect(coreTaskCount).toBeGreaterThanOrEqual(elecTaskCount)
      expect(result[0].enrollmentId).toBe('core-1')
    })

    it('prioritizes elective over memorization', () => {
      const elective = makeEnrollment({
        enrollmentId: 'elec-1',
        enrollmentType: 'elective',
        pendingTasks: makePendingTasks(5, 'elec'),
        curriculumTitle: 'Elective',
      })
      const memo = makeEnrollment({
        enrollmentId: 'memo-1',
        enrollmentType: 'memorization',
        targetLoops: 3,
        completedLoops: 0,
        pendingTasks: makePendingTasks(5, 'memo'),
        curriculumTitle: 'Memorization',
      })
      const result = selectTasks([memo, elective], 3, TODAY)
      expect(result[0].enrollmentId).toBe('elec-1')
    })
  })

  describe('urgency-based selection', () => {
    it('gives overdue enrollments highest priority', () => {
      const overdue = makeEnrollment({
        enrollmentId: 'overdue-1',
        enrollmentType: 'elective', // Lower type priority
        targetCompletionDate: '2026-03-10', // Past due
        totalTasks: 10,
        completedTasks: 5,
        pendingTasks: makePendingTasks(5, 'overdue'),
        curriculumTitle: 'Overdue Elective',
      })
      const onTrack = makeEnrollment({
        enrollmentId: 'core-1',
        enrollmentType: 'core', // Higher type priority
        targetCompletionDate: '2026-06-01', // Far future
        totalTasks: 50,
        completedTasks: 0,
        pendingTasks: makePendingTasks(50, 'core'),
        curriculumTitle: 'Core On Track',
      })
      const result = selectTasks([onTrack, overdue], 3, TODAY)
      // Overdue should come first despite being elective
      expect(result[0].enrollmentId).toBe('overdue-1')
    })

    it('assigns more tasks to behind-schedule enrollments', () => {
      const behind = makeEnrollment({
        enrollmentId: 'behind-1',
        enrollmentType: 'core',
        targetCompletionDate: '2026-03-20', // Only 5 days left
        studyDaysPerWeek: 7,
        totalTasks: 20,
        completedTasks: 5,
        pendingTasks: makePendingTasks(15, 'behind'),
        curriculumTitle: 'Behind Schedule',
      })
      const relaxed = makeEnrollment({
        enrollmentId: 'relaxed-1',
        enrollmentType: 'core',
        targetCompletionDate: '2026-12-01', // Months away
        studyDaysPerWeek: 5,
        totalTasks: 20,
        completedTasks: 0,
        pendingTasks: makePendingTasks(20, 'relaxed'),
        curriculumTitle: 'Relaxed Schedule',
      })
      const result = selectTasks([relaxed, behind], 6, TODAY)
      const behindCount = result.filter((t) => t.enrollmentId === 'behind-1').length
      const relaxedCount = result.filter((t) => t.enrollmentId === 'relaxed-1').length
      expect(behindCount).toBeGreaterThan(relaxedCount)
    })
  })

  describe('no-target enrollments', () => {
    it('includes no-target enrollments at lowest priority', () => {
      const noTarget = makeEnrollment({
        enrollmentId: 'no-target-1',
        enrollmentType: 'elective',
        targetCompletionDate: null,
        pendingTasks: makePendingTasks(5, 'nt'),
        curriculumTitle: 'No Target',
      })
      const result = selectTasks([noTarget], 3, TODAY)
      expect(result.length).toBeGreaterThan(0)
    })

    it('gives targeted enrollments priority over no-target', () => {
      const targeted = makeEnrollment({
        enrollmentId: 'targeted-1',
        enrollmentType: 'elective',
        targetCompletionDate: '2026-04-01',
        pendingTasks: makePendingTasks(5, 'tgt'),
        curriculumTitle: 'Targeted',
      })
      const noTarget = makeEnrollment({
        enrollmentId: 'no-target-1',
        enrollmentType: 'elective',
        targetCompletionDate: null,
        pendingTasks: makePendingTasks(5, 'nt'),
        curriculumTitle: 'No Target',
      })
      const result = selectTasks([noTarget, targeted], 2, TODAY)
      expect(result[0].enrollmentId).toBe('targeted-1')
    })
  })

  describe('memorization enrollments', () => {
    it('handles memorization with loop context', () => {
      const memo = makeEnrollment({
        enrollmentId: 'memo-1',
        enrollmentType: 'memorization',
        targetCompletionDate: '2026-05-01',
        totalTasks: 10,
        completedTasks: 3,
        targetLoops: 5,
        completedLoops: 2,
        pendingTasks: makePendingTasks(7, 'memo'),
        curriculumTitle: 'Memorization',
      })
      const result = selectTasks([memo], 3, TODAY)
      expect(result).toHaveLength(3)
      expect(result[0].enrollmentId).toBe('memo-1')
    })
  })

  describe('multi-enrollment distribution', () => {
    it('distributes tasks across multiple enrollments', () => {
      const enrollments = [
        makeEnrollment({
          enrollmentId: 'e1',
          enrollmentType: 'core',
          pendingTasks: makePendingTasks(10, 'e1'),
          curriculumTitle: 'Core A',
        }),
        makeEnrollment({
          enrollmentId: 'e2',
          enrollmentType: 'core',
          pendingTasks: makePendingTasks(10, 'e2'),
          curriculumTitle: 'Core B',
        }),
        makeEnrollment({
          enrollmentId: 'e3',
          enrollmentType: 'elective',
          pendingTasks: makePendingTasks(10, 'e3'),
          curriculumTitle: 'Elective A',
        }),
      ]
      const result = selectTasks(enrollments, 6, TODAY)
      // All enrollments should get at least some tasks
      const e1Count = result.filter((t) => t.enrollmentId === 'e1').length
      const e2Count = result.filter((t) => t.enrollmentId === 'e2').length
      const e3Count = result.filter((t) => t.enrollmentId === 'e3').length
      expect(e1Count).toBeGreaterThan(0)
      expect(e2Count).toBeGreaterThan(0)
      expect(e3Count).toBeGreaterThan(0)
    })

    it('respects taskCount=1', () => {
      const enrollments = [
        makeEnrollment({
          enrollmentId: 'e1',
          pendingTasks: makePendingTasks(5, 'e1'),
          curriculumTitle: 'A',
        }),
        makeEnrollment({
          enrollmentId: 'e2',
          pendingTasks: makePendingTasks(5, 'e2'),
          curriculumTitle: 'B',
        }),
      ]
      const result = selectTasks(enrollments, 1, TODAY)
      expect(result).toHaveLength(1)
    })

    it('handles single task available across many enrollments', () => {
      const enrollments = Array.from({ length: 5 }, (_, i) =>
        makeEnrollment({
          enrollmentId: `e${i}`,
          pendingTasks: makePendingTasks(1, `e${i}`),
          curriculumTitle: `Curriculum ${i}`,
        })
      )
      const result = selectTasks(enrollments, 20, TODAY)
      expect(result).toHaveLength(5) // Only 5 tasks total available
    })
  })

  describe('edge cases', () => {
    it('handles all enrollments complete', () => {
      const enrollment = makeEnrollment({
        totalTasks: 10,
        completedTasks: 10,
        pendingTasks: [],
      })
      expect(selectTasks([enrollment], 5, TODAY)).toEqual([])
    })

    it('preserves loopNumber in selections', () => {
      const tasks = makePendingTasks(3, 'memo')
      tasks.forEach((t) => (t.loopNumber = 3))
      const enrollment = makeEnrollment({
        enrollmentType: 'memorization',
        targetLoops: 5,
        completedLoops: 2,
        pendingTasks: tasks,
        curriculumTitle: 'Memo',
      })
      const result = selectTasks([enrollment], 2, TODAY)
      expect(result[0].loopNumber).toBe(3)
      expect(result[1].loopNumber).toBe(3)
    })

    it('is deterministic: same inputs produce same outputs', () => {
      const enrollments = [
        makeEnrollment({
          enrollmentId: 'e1',
          enrollmentType: 'core',
          pendingTasks: makePendingTasks(5, 'e1'),
          curriculumTitle: 'Core',
        }),
        makeEnrollment({
          enrollmentId: 'e2',
          enrollmentType: 'elective',
          pendingTasks: makePendingTasks(5, 'e2'),
          curriculumTitle: 'Elective',
        }),
      ]
      const result1 = selectTasks(enrollments, 4, TODAY)
      const result2 = selectTasks(enrollments, 4, TODAY)
      expect(result1).toEqual(result2)
    })

    it('handles taskCount of 0', () => {
      const enrollment = makeEnrollment({ pendingTasks: makePendingTasks(5) })
      expect(selectTasks([enrollment], 0, TODAY)).toEqual([])
    })
  })

  describe('start date filtering', () => {
    it('excludes enrollments with a future start date', () => {
      const enrollment = makeEnrollment({ startDate: '2026-03-20' })
      expect(selectTasks([enrollment], 5, TODAY)).toEqual([])
    })

    it('includes enrollments starting today', () => {
      const enrollment = makeEnrollment({ startDate: TODAY })
      expect(selectTasks([enrollment], 5, TODAY)).toHaveLength(5)
    })

    it('includes enrollments with a past start date', () => {
      const enrollment = makeEnrollment({ startDate: '2026-01-01' })
      expect(selectTasks([enrollment], 5, TODAY)).toHaveLength(5)
    })

    it('includes enrollments with no start date (backward compat)', () => {
      const enrollment = makeEnrollment()
      expect(selectTasks([enrollment], 5, TODAY)).toHaveLength(5)
    })

    it('selects only from started enrollments when mixed with future ones', () => {
      const futureCore = makeEnrollment({
        enrollmentId: 'future-core',
        enrollmentType: 'core',
        startDate: '2026-04-01',
        pendingTasks: makePendingTasks(5, 'fc'),
        curriculumTitle: 'Future Core',
      })
      const startedElective = makeEnrollment({
        enrollmentId: 'started-elec',
        enrollmentType: 'elective',
        startDate: '2026-03-01',
        pendingTasks: makePendingTasks(5, 'se'),
        curriculumTitle: 'Started Elective',
      })
      const result = selectTasks([futureCore, startedElective], 4, TODAY)
      expect(result).toHaveLength(4)
      expect(result.every((t) => t.enrollmentId === 'started-elec')).toBe(true)
    })

    it('excludes a future enrollment even when its target date makes it urgent', () => {
      const enrollment = makeEnrollment({
        startDate: '2026-03-20',
        targetCompletionDate: '2026-03-25', // would be highly urgent if eligible
      })
      expect(selectTasks([enrollment], 5, TODAY)).toEqual([])
    })
  })
})
