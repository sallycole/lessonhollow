import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TodayClient, type TodayTask } from './today-client'

const mockRefresh = vi.fn()
const reorderTodayTasksAction = vi.fn()
const finishedForTodayAction = vi.fn()
const startTaskAction = vi.fn()
const pauseTaskAction = vi.fn()
const unpauseTaskAction = vi.fn()
const completeTaskAction = vi.fn()
const unfinishTaskAction = vi.fn()
const autoPopulateAction = vi.fn()
const removeTaskAction = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

vi.mock('./actions', () => ({
  reorderTodayTasksAction: (...args: unknown[]) => reorderTodayTasksAction(...args),
  finishedForTodayAction: (...args: unknown[]) => finishedForTodayAction(...args),
  startTaskAction: (...args: unknown[]) => startTaskAction(...args),
  pauseTaskAction: (...args: unknown[]) => pauseTaskAction(...args),
  unpauseTaskAction: (...args: unknown[]) => unpauseTaskAction(...args),
  completeTaskAction: (...args: unknown[]) => completeTaskAction(...args),
  unfinishTaskAction: (...args: unknown[]) => unfinishTaskAction(...args),
  autoPopulateAction: (...args: unknown[]) => autoPopulateAction(...args),
  removeTaskAction: (...args: unknown[]) => removeTaskAction(...args),
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => children,
  closestCenter: vi.fn(),
  KeyboardSensor: class {},
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: (items: unknown[], from: number, to: number) => {
    const copy = [...items]
    const [item] = copy.splice(from, 1)
    copy.splice(to, 0, item)
    return copy
  },
  SortableContext: ({ children }: { children: ReactNode }) => children,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}))

function task(id: string, title: string): TodayTask {
  return {
    id,
    taskId: `task-${id}`,
    enrollmentId: `enroll-${id}`,
    curriculumId: `curr-${id}`,
    title,
    description: null,
    actionType: 'Do',
    resourceUrl: null,
    curriculumName: 'Math',
    status: 'promoted',
    timeSpentMinutes: null,
    promotedAt: new Date('2026-03-18T12:00:00Z').toISOString(),
    displayOrder: null,
    timerStartedAt: null,
    accumulatedSeconds: 0,
    startedAt: null,
  }
}

describe('TodayClient optimistic rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reorderTodayTasksAction.mockResolvedValue({})
    startTaskAction.mockResolvedValue({ error: 'Failed to start task.' })
    pauseTaskAction.mockResolvedValue({})
    unpauseTaskAction.mockResolvedValue({})
    completeTaskAction.mockResolvedValue({})
    unfinishTaskAction.mockResolvedValue({})
    finishedForTodayAction.mockResolvedValue({})
    autoPopulateAction.mockResolvedValue({})
    removeTaskAction.mockResolvedValue({})
  })

  it('rolls back to the latest stable state instead of the initial mount snapshot', async () => {
    render(
      <TodayClient
        tasks={[task('a', 'Alpha'), task('b', 'Beta'), task('c', 'Gamma')]}
        playerFirstName="Ada"
        hasActiveEnrollments
        isGuide={false}
      />
    )

    const alphaCard = screen.getByText('Alpha').closest('[role="listitem"], div')
    expect(screen.getAllByRole('button', { name: 'Move down' })).toHaveLength(3)

    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0])

    await waitFor(() => {
      expect(reorderTodayTasksAction).toHaveBeenCalledOnce()
    })

    const listAfterReorder = screen.getByRole('list', { name: "Today's task list" }).textContent ?? ''
    expect(listAfterReorder.indexOf('Beta')).toBeLessThan(listAfterReorder.indexOf('Alpha'))
    expect(listAfterReorder.indexOf('Alpha')).toBeLessThan(listAfterReorder.indexOf('Gamma'))

    fireEvent.click(screen.getAllByRole('button', { name: 'Start' })[0])

    await waitFor(() => {
      expect(startTaskAction).toHaveBeenCalledOnce()
    })

    const listAfterFailedStart = screen.getByRole('list', { name: "Today's task list" }).textContent ?? ''
    expect(listAfterFailedStart.indexOf('Beta')).toBeLessThan(listAfterFailedStart.indexOf('Alpha'))
    expect(listAfterFailedStart.indexOf('Alpha')).toBeLessThan(listAfterFailedStart.indexOf('Gamma'))
    expect(listAfterFailedStart.indexOf('Alpha')).not.toBeLessThan(listAfterFailedStart.indexOf('Beta'))
    expect(alphaCard).toBeTruthy()
  })

  it('preserves elapsed time across pause (regression: timer reset to 0)', async () => {
    const fortyFiveSecondsAgo = new Date(Date.now() - 45_000).toISOString()
    const activeTask: TodayTask = {
      ...task('a', 'Long Read'),
      timerStartedAt: fortyFiveSecondsAgo,
      startedAt: fortyFiveSecondsAgo,
      accumulatedSeconds: 0,
    }

    render(
      <TodayClient
        tasks={[activeTask]}
        playerFirstName="Ada"
        hasActiveEnrollments
        isGuide={false}
      />
    )

    // Running timer reads ~45 seconds (allow 1s drift for test execution)
    const before = parseElapsedSeconds(screen.getByRole('timer').textContent ?? '')
    expect(before).toBeGreaterThanOrEqual(45)
    expect(before).toBeLessThanOrEqual(46)

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))

    await waitFor(() => {
      expect(pauseTaskAction).toHaveBeenCalledWith(activeTask.id)
    })

    // After pause, the displayed value must still reflect the elapsed segment.
    // Pre-fix bug: this dropped to 0 because the optimistic update zeroed the timer.
    const after = parseElapsedSeconds(screen.getByRole('timer').textContent ?? '')
    expect(after).toBeGreaterThanOrEqual(45)
    expect(after).toBeLessThanOrEqual(47)
  })

  it('finishing a task with under a minute logged routes to unfinish, not complete', async () => {
    const fifteenSecondsAgo = new Date(Date.now() - 15_000).toISOString()
    const activeTask: TodayTask = {
      ...task('a', 'Quick'),
      timerStartedAt: fifteenSecondsAgo,
      startedAt: fifteenSecondsAgo,
      accumulatedSeconds: 0,
    }

    render(
      <TodayClient
        tasks={[activeTask]}
        playerFirstName="Ada"
        hasActiveEnrollments
        isGuide={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))

    // Calculated total rounds to 0 minutes, so the screen-1 confirm button
    // must read "Yes, Return to Plan" (answers "Is that accurate?" + names
    // the action) and clicking it must call unfinishTaskAction.
    const returnButton = await screen.findByRole('button', { name: 'Yes, Return to Plan' })
    fireEvent.click(returnButton)

    await waitFor(() => {
      expect(unfinishTaskAction).toHaveBeenCalledWith(activeTask.id)
    })
    expect(completeTaskAction).not.toHaveBeenCalled()
  })
})

function parseElapsedSeconds(text: string): number {
  const parts = text.split(':').map((n) => parseInt(n, 10))
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return NaN
}
