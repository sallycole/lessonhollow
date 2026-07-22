import { describe, it, expect } from 'vitest'
import { countCompletedLoops } from '../loop-counter'

describe('countCompletedLoops', () => {
  it('returns 0 for no tasks', () => {
    expect(countCompletedLoops(0, [])).toBe(0)
  })

  it('returns 0 for no player task records', () => {
    expect(countCompletedLoops(5, [])).toBe(0)
  })

  it('returns 0 when loop 1 is partially completed', () => {
    const playerTasks = [
      { task_id: 'a', status: 'completed', loop_number: 1 },
      { task_id: 'b', status: 'completed', loop_number: 1 },
      // task c not yet completed
    ]
    expect(countCompletedLoops(3, playerTasks)).toBe(0)
  })

  it('returns 1 when all tasks in loop 1 are completed', () => {
    const playerTasks = [
      { task_id: 'a', status: 'completed', loop_number: 1 },
      { task_id: 'b', status: 'completed', loop_number: 1 },
      { task_id: 'c', status: 'completed', loop_number: 1 },
    ]
    expect(countCompletedLoops(3, playerTasks)).toBe(1)
  })

  it('returns 1 when loop 1 complete and loop 2 partial', () => {
    const playerTasks = [
      { task_id: 'a', status: 'completed', loop_number: 1 },
      { task_id: 'b', status: 'completed', loop_number: 1 },
      { task_id: 'c', status: 'completed', loop_number: 1 },
      { task_id: 'a', status: 'completed', loop_number: 2 },
      // b and c not yet done in loop 2
    ]
    expect(countCompletedLoops(3, playerTasks)).toBe(1)
  })

  it('returns 2 when loops 1 and 2 are both fully completed', () => {
    const playerTasks = [
      { task_id: 'a', status: 'completed', loop_number: 1 },
      { task_id: 'b', status: 'completed', loop_number: 1 },
      { task_id: 'a', status: 'completed', loop_number: 2 },
      { task_id: 'b', status: 'completed', loop_number: 2 },
    ]
    expect(countCompletedLoops(2, playerTasks)).toBe(2)
  })

  it('excludes permanently skipped tasks from the required count', () => {
    // 3 total tasks, task c is skipped in loop 1 (permanently skipped)
    // So only a and b need to be completed per loop
    const playerTasks = [
      { task_id: 'a', status: 'completed', loop_number: 1 },
      { task_id: 'b', status: 'completed', loop_number: 1 },
      { task_id: 'c', status: 'skipped', loop_number: 1 },
    ]
    expect(countCompletedLoops(3, playerTasks)).toBe(1)
  })

  it('handles multiple loops with permanently skipped tasks', () => {
    // 4 tasks, task d skipped in loop 1 → permanently excluded
    // Loop 1: a,b,c completed, d skipped → complete (3/3 effective)
    // Loop 2: a,b,c completed → complete (3/3 effective)
    // Loop 3: a completed → partial
    const playerTasks = [
      { task_id: 'a', status: 'completed', loop_number: 1 },
      { task_id: 'b', status: 'completed', loop_number: 1 },
      { task_id: 'c', status: 'completed', loop_number: 1 },
      { task_id: 'd', status: 'skipped', loop_number: 1 },
      { task_id: 'a', status: 'completed', loop_number: 2 },
      { task_id: 'b', status: 'completed', loop_number: 2 },
      { task_id: 'c', status: 'completed', loop_number: 2 },
      { task_id: 'a', status: 'completed', loop_number: 3 },
    ]
    expect(countCompletedLoops(4, playerTasks)).toBe(2)
  })

  it('returns 0 when all tasks are permanently skipped', () => {
    const playerTasks = [
      { task_id: 'a', status: 'skipped', loop_number: 1 },
      { task_id: 'b', status: 'skipped', loop_number: 1 },
    ]
    expect(countCompletedLoops(2, playerTasks)).toBe(0)
  })

  it('does not count a skipped task as completed even in its own loop', () => {
    // Task b is skipped → permanently skipped → only task a needed
    // But task a is not completed in loop 1
    const playerTasks = [
      { task_id: 'b', status: 'skipped', loop_number: 1 },
    ]
    expect(countCompletedLoops(2, playerTasks)).toBe(0)
  })

  it('handles promoted tasks correctly (not counting them as completed)', () => {
    const playerTasks = [
      { task_id: 'a', status: 'completed', loop_number: 1 },
      { task_id: 'b', status: 'promoted', loop_number: 1 },
      { task_id: 'c', status: 'completed', loop_number: 1 },
    ]
    // b is promoted (in progress), not completed → loop 1 not complete
    expect(countCompletedLoops(3, playerTasks)).toBe(0)
  })

  it('requires consecutive loops starting from 1', () => {
    // Loop 1 incomplete, loop 2 complete — should still be 0
    const playerTasks = [
      { task_id: 'a', status: 'completed', loop_number: 1 },
      // b missing in loop 1
      { task_id: 'a', status: 'completed', loop_number: 2 },
      { task_id: 'b', status: 'completed', loop_number: 2 },
    ]
    expect(countCompletedLoops(2, playerTasks)).toBe(0)
  })

  it('does not double-count a task completed and later skipped', () => {
    // Task b completed in loop 1, then skipped in loop 3
    // Since b has a 'skipped' entry, it's permanently skipped
    // So effective tasks = 2 (only a and c)
    // Loop 1: a completed, c completed → 2/2 effective → complete
    // Loop 2: a completed, c completed → 2/2 effective → complete
    const playerTasks = [
      { task_id: 'a', status: 'completed', loop_number: 1 },
      { task_id: 'b', status: 'completed', loop_number: 1 },
      { task_id: 'c', status: 'completed', loop_number: 1 },
      { task_id: 'a', status: 'completed', loop_number: 2 },
      { task_id: 'c', status: 'completed', loop_number: 2 },
      { task_id: 'b', status: 'skipped', loop_number: 3 },
    ]
    // b is permanently skipped (has skipped entry), effective = 2
    // Loop 1: a+c completed (b was also completed, but excluded from count since permanently skipped) = 2/2 → complete
    // Loop 2: a+c = 2/2 → complete
    expect(countCompletedLoops(3, playerTasks)).toBe(2)
  })
})
