'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ExternalLink, BookOpen, Pencil } from 'lucide-react'
import {
  reorderTodayTasksAction,
  finishedForTodayAction,
  startTaskAction,
  pauseTaskAction,
  unpauseTaskAction,
  completeTaskAction,
  unfinishTaskAction,
  autoPopulateAction,
  removeTaskAction,
  updateTaskContentAction,
} from './actions'

export type TodayTask = {
  id: string
  taskId: string
  enrollmentId: string
  curriculumId: string
  title: string
  description: string | null
  actionType: string
  resourceUrl: string | null
  curriculumName: string
  status: 'promoted' | 'completed'
  timeSpentMinutes: number | null
  promotedAt: string
  displayOrder: number | null
  timerStartedAt: string | null
  accumulatedSeconds: number
  startedAt: string | null
}

function formatTime(totalMinutes: number): string {
  const rounded = Math.ceil(totalMinutes)
  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60
  return `${hours}h ${minutes}m`
}

function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) return `${hours}:${mm}:${ss}`
  return `${mm}:${ss}`
}

function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const handler = () => onClose()
    node.addEventListener('close', handler)
    return () => node.removeEventListener('close', handler)
  }, [onClose])

  return ref
}

// Bumps accumulatedSeconds by the in-flight segment so the optimistic UI
// matches db.pauseTask's persisted value before the next refresh. Without this,
// pausing nulls timerStartedAt and the displayed timer drops to 0.
function pauseTaskOptimistic(task: TodayTask): TodayTask {
  if (task.timerStartedAt == null) return task
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(task.timerStartedAt).getTime()) / 1000),
  )
  return {
    ...task,
    timerStartedAt: null,
    accumulatedSeconds: (task.accumulatedSeconds ?? 0) + elapsedSeconds,
  }
}

function StatCards({
  completedCount,
  totalCount,
  timeSpentMinutes,
}: {
  completedCount: number
  totalCount: number
  timeSpentMinutes: number
}) {
  return (
    <section className="stat-cards" aria-label="Today's stats">
      <article>
        <hgroup>
          <h4>Today&apos;s progress</h4>
          <p>
            <strong>
              {completedCount} of {totalCount}
            </strong>{' '}
            tasks completed
          </p>
        </hgroup>
      </article>
      <article>
        <hgroup>
          <h4>Today&apos;s time spent</h4>
          <p>
            <strong>{formatTime(timeSpentMinutes)}</strong> total study time
          </p>
        </hgroup>
      </article>
    </section>
  )
}

function IconKey({ isMobile }: { isMobile?: boolean }) {
  return (
    <aside className="icon-key" aria-label="Icon key">
      <strong>Icon Key</strong>
      <dl>
        {isMobile ? (
          <>
            <dt aria-hidden="true">▲▼</dt>
            <dd>Move up/down</dd>
          </>
        ) : (
          <>
            <dt aria-hidden="true">
              <GripVertical size={14} />
            </dt>
            <dd>Drag to reorder</dd>
          </>
        )}
        <dt aria-hidden="true">
          <ExternalLink size={14} />
        </dt>
        <dd>Open resource</dd>
      </dl>
    </aside>
  )
}

function TimerDisplay({
  timerStartedAt,
  accumulatedSeconds,
}: {
  timerStartedAt: string | null
  accumulatedSeconds: number
}) {
  const isActive = timerStartedAt != null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isActive, timerStartedAt])

  let elapsed = accumulatedSeconds
  if (isActive && timerStartedAt) {
    const started = new Date(timerStartedAt).getTime()
    elapsed = accumulatedSeconds + Math.max(0, Math.floor((now - started) / 1000))
  }

  return (
    <time
      data-status={isActive ? 'active' : 'paused'}
      role="timer"
      aria-label={`Elapsed time: ${formatElapsed(elapsed)}`}
    >
      {formatElapsed(elapsed)}
    </time>
  )
}

function SortableTaskCard({
  task,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onStart,
  onPause,
  onUnpause,
  onFinish,
  onRemove,
  onTaskUpdated,
  starting,
  pausing,
  removing,
  canRemove,
}: {
  task: TodayTask
  index: number
  total: number
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onStart: (taskId: string) => void
  onPause: (taskId: string) => void
  onUnpause: (taskId: string) => void
  onFinish: (taskId: string) => void
  onRemove: (taskId: string) => void
  onTaskUpdated: (
    playerTaskId: string,
    changes: { title: string; description: string; resourceUrl: string },
  ) => void
  starting: boolean
  pausing: boolean
  removing: boolean
  canRemove: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: isDragging ? ('relative' as const) : undefined,
    zIndex: isDragging ? 10 : undefined,
  }

  const isCompleted = task.status === 'completed'
  const isActive = task.timerStartedAt != null
  const isPaused = !isActive && task.startedAt != null && !isCompleted
  const statusAttr = isCompleted
    ? 'completed'
    : isActive
      ? 'active'
      : isPaused
        ? 'paused'
        : 'pending'

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDescription, setEditDescription] = useState(task.description ?? '')
  const [editResourceUrl, setEditResourceUrl] = useState(task.resourceUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  function openEdit() {
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditResourceUrl(task.resourceUrl ?? '')
    setFieldErrors({})
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
    setFieldErrors({})
  }

  async function saveEdit() {
    setSaving(true)
    const result = await updateTaskContentAction(task.taskId, {
      title: editTitle,
      description: editDescription,
      resourceUrl: editResourceUrl,
    })
    setSaving(false)
    if (result.error) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors)
      toast.error(result.error)
      return
    }
    onTaskUpdated(task.id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      resourceUrl: editResourceUrl.trim(),
    })
    setIsEditing(false)
    setFieldErrors({})
    toast.success('Task updated')
  }

  return (
    <article ref={setNodeRef} style={style} data-status={statusAttr}>
      {/* Top-right cluster: edit appears to the LEFT of drag/reorder so drag
          stays pinned to the corner and doesn't shift when edit mode toggles. */}
      <div className="card-controls-top">
        {canRemove && !isEditing && (
          <button
            type="button"
            className="icon-button"
            onClick={openEdit}
            aria-label={`Edit ${task.title}`}
          >
            <Pencil size={14} />
          </button>
        )}
        {/* Desktop: drag handle */}
        <button
          type="button"
          className="drag-handle"
          data-viewport="desktop"
          aria-label={`Drag to reorder ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>
        {/* Mobile: up/down */}
        <button
          type="button"
          className="icon-button"
          data-viewport="mobile"
          aria-label="Move up"
          disabled={index === 0}
          onClick={() => onMoveUp(index)}
        >
          ▲
        </button>
        <button
          type="button"
          className="icon-button"
          data-viewport="mobile"
          aria-label="Move down"
          disabled={index === total - 1}
          onClick={() => onMoveDown(index)}
        >
          ▼
        </button>
      </div>

      {isEditing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveEdit()
          }}
        >
          <label>
            Title
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Task title"
              disabled={saving}
              aria-invalid={fieldErrors.title ? 'true' : undefined}
            />
            {fieldErrors.title && <p className="field-error">{fieldErrors.title[0]}</p>}
          </label>
          <label>
            Description
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              disabled={saving}
              aria-invalid={fieldErrors.description ? 'true' : undefined}
            />
            {fieldErrors.description && <p className="field-error">{fieldErrors.description[0]}</p>}
          </label>
          <label>
            Resource URL
            <input
              type="url"
              value={editResourceUrl}
              onChange={(e) => setEditResourceUrl(e.target.value)}
              placeholder="Resource URL (optional)"
              disabled={saving}
              aria-invalid={fieldErrors.resource_url ? 'true' : undefined}
            />
            {fieldErrors.resource_url && <p className="field-error">{fieldErrors.resource_url[0]}</p>}
          </label>
          <footer>
            <button type="button" className="secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </footer>
        </form>
      ) : (
        <div className="card-content">
          {/* Top-left quadrant: curriculum name + action tag + title + ext-link */}
          <h4 className="curriculum-name">{task.curriculumName}</h4>
          <div className="task-title-row">
            <span className="action-badge">{task.actionType}</span>
            <strong className="task-title">{task.title}</strong>
            {task.resourceUrl && (
              <a
                href={task.resourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open resource"
                className="task-resource"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {/* Bottom row: description (bottom-left) + button(s) (bottom-right) share a single horizontal row */}
          <div className="card-body-row" data-status={statusAttr}>
            <div className="card-body-description">
              {task.description && <p className="task-description">{task.description}</p>}
            </div>
            <div className="card-body-actions">
              {isCompleted ? (
                <button type="button" className="outline" disabled>
                  Completed ✓
                </button>
              ) : isActive ? (
                <>
                  <TimerDisplay
                    timerStartedAt={task.timerStartedAt}
                    accumulatedSeconds={task.accumulatedSeconds}
                  />
                  <button
                    className="outline"
                    onClick={() => onPause(task.id)}
                    disabled={pausing}
                  >
                    Pause
                  </button>
                  <button onClick={() => onFinish(task.id)}>Finish</button>
                </>
              ) : isPaused ? (
                <>
                  <TimerDisplay
                    timerStartedAt={null}
                    accumulatedSeconds={task.accumulatedSeconds}
                  />
                  <button onClick={() => onUnpause(task.id)} disabled={pausing}>
                    Unpause
                  </button>
                </>
              ) : (
                <>
                  {canRemove && (
                    <button
                      className="outline secondary"
                      onClick={() => onRemove(task.id)}
                      disabled={removing}
                    >
                      Remove
                    </button>
                  )}
                  <button onClick={() => onStart(task.id)} disabled={starting}>
                    Start
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

function EmptyState({
  hasActiveEnrollments,
  onAutoPopulate,
}: {
  hasActiveEnrollments: boolean
  onAutoPopulate: () => void
}) {
  // hasActiveEnrollments + onAutoPopulate are kept in the signature to match the
  // existing parent contract; the current empty-state UI links to /plan.
  void hasActiveEnrollments
  void onAutoPopulate
  return (
    <article style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <BookOpen size={40} style={{ opacity: 0.5, margin: '0 auto 0.75rem' }} />
      <p>No active tasks.</p>
      <Link href="/plan" role="button" className="outline">
        Plan today&apos;s activities
      </Link>
    </article>
  )
}

export function TodayClient({
  tasks: initialTasks,
  playerFirstName,
  hasActiveEnrollments,
  isGuide,
}: {
  tasks: TodayTask[]
  playerFirstName: string
  hasActiveEnrollments: boolean
  isGuide: boolean
}) {
  void playerFirstName // currently unused in the render layer; kept for parity with server contract

  const [tasks, setTasks] = useState<TodayTask[]>(initialTasks)
  const stableTasksRef = useRef<TodayTask[]>(initialTasks)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [pausing, setPausing] = useState(false)
  const [finishedOpen, setFinishedOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishModalTaskId, setFinishModalTaskId] = useState<string | null>(null)
  const [finishModalScreen, setFinishModalScreen] = useState<1 | 2>(1)
  const [finishModalSeconds, setFinishModalSeconds] = useState(0)
  const [correctedMinutes, setCorrectedMinutes] = useState('')
  const [completing, setCompleting] = useState(false)
  const [finishModalError, setFinishModalError] = useState<string | null>(null)
  const [autoPopulateOpen, setAutoPopulateOpen] = useState(false)
  const [autoPopulateCount, setAutoPopulateCount] = useState(5)
  const [autoPopulating, setAutoPopulating] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const finishedDialogRef = useNativeDialog(finishedOpen, () => setFinishedOpen(false))
  const durationDialogRef = useNativeDialog(finishModalTaskId !== null, () =>
    setFinishModalTaskId(null),
  )
  const autoPopulateDialogRef = useNativeDialog(autoPopulateOpen, () =>
    setAutoPopulateOpen(false),
  )

  const persistOrder = useCallback(async (reordered: TodayTask[]) => {
    const updates = reordered.map((task, i) => ({
      id: task.id,
      display_order: (i + 1) * 10,
    }))
    setSaving(true)
    const result = await reorderTodayTasksAction(updates)
    setSaving(false)
    if (!result.error) {
      setTasks((prev) => {
        const updated = prev.map((t, i) => ({ ...t, displayOrder: (i + 1) * 10 }))
        stableTasksRef.current = updated
        return updated
      })
    } else {
      setTasks(stableTasksRef.current)
    }
  }, [])

  const moveItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      const reordered = arrayMove(tasks, fromIndex, toIndex)
      setTasks(reordered)
      persistOrder(reordered)
    },
    [tasks, persistOrder],
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = tasks.findIndex((t) => t.id === active.id)
    const newIndex = tasks.findIndex((t) => t.id === over.id)
    moveItem(oldIndex, newIndex)
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const totalCount = tasks.length
  const timeSpentMinutes = tasks
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + (t.timeSpentMinutes ?? 0), 0)

  const hasTasks = tasks.length > 0
  const unfinishedCount = tasks.filter((t) => t.status !== 'completed').length
  const hasRunningTimer = tasks.some(
    (t) => t.status === 'promoted' && t.timerStartedAt != null,
  )

  async function handleStart(playerTaskId: string) {
    const task = tasks.find((t) => t.id === playerTaskId)
    if (!task) return
    if (task.resourceUrl) {
      window.open(task.resourceUrl, '_blank', 'noopener,noreferrer')
    }
    setStarting(true)
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === playerTaskId) {
          return {
            ...t,
            timerStartedAt: new Date().toISOString(),
            startedAt: t.startedAt ?? new Date().toISOString(),
          }
        }
        if (t.timerStartedAt != null && t.status === 'promoted') {
          return pauseTaskOptimistic(t)
        }
        return t
      }),
    )
    const result = await startTaskAction(playerTaskId)
    setStarting(false)
    if (result.error) {
      setTasks(stableTasksRef.current)
    } else {
      setTasks((current) => {
        stableTasksRef.current = current
        return current
      })
    }
  }

  async function handlePause(playerTaskId: string) {
    setPausing(true)
    setTasks((prev) =>
      prev.map((t) => (t.id === playerTaskId ? pauseTaskOptimistic(t) : t)),
    )
    const result = await pauseTaskAction(playerTaskId)
    setPausing(false)
    if (result.error) {
      setTasks(stableTasksRef.current)
    } else {
      setTasks((current) => {
        stableTasksRef.current = current
        return current
      })
    }
  }

  async function handleUnpause(playerTaskId: string) {
    const task = tasks.find((t) => t.id === playerTaskId)
    if (!task) return
    if (task.resourceUrl) {
      window.open(task.resourceUrl, '_blank', 'noopener,noreferrer')
    }
    setPausing(true)
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === playerTaskId) {
          return { ...t, timerStartedAt: new Date().toISOString() }
        }
        if (t.timerStartedAt != null && t.status === 'promoted') {
          return pauseTaskOptimistic(t)
        }
        return t
      }),
    )
    const result = await unpauseTaskAction(playerTaskId)
    setPausing(false)
    if (result.error) {
      setTasks(stableTasksRef.current)
    } else {
      setTasks((current) => {
        stableTasksRef.current = current
        return current
      })
    }
  }

  function getTaskTotalSeconds(task: TodayTask): number {
    let total = task.accumulatedSeconds ?? 0
    if (task.timerStartedAt) {
      const elapsed = Math.floor(
        (Date.now() - new Date(task.timerStartedAt).getTime()) / 1000,
      )
      total += elapsed
    }
    return Math.max(0, total)
  }

  function handleOpenFinishModal(playerTaskId: string) {
    const task = tasks.find((t) => t.id === playerTaskId)
    if (!task) return
    const totalSec = getTaskTotalSeconds(task)
    setFinishModalTaskId(playerTaskId)
    setFinishModalScreen(1)
    setFinishModalSeconds(totalSec)
    setCorrectedMinutes(String(Math.round(totalSec / 60)))
    setCompleting(false)
    setFinishModalError(null)
  }

  // Zero total time means the task wasn't really done — return it to the Plan
  // inventory as pending instead of saving it completed with zero minutes.
  async function returnTaskToPlan(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setFinishModalTaskId(null)
    setCompleting(false)
    const result = await unfinishTaskAction(taskId)
    if (result.error) {
      setTasks(stableTasksRef.current)
      toast.error(result.error)
      return
    }
    setTasks((current) => {
      stableTasksRef.current = current
      return current
    })
    toast.success('Task returned to Plan inventory.')
  }

  async function handleConfirmFinish(useCalculated: boolean) {
    if (!finishModalTaskId) return
    setCompleting(true)
    setFinishModalError(null)

    let confirmedSeconds: number
    if (!useCalculated) {
      const mins = parseInt(correctedMinutes, 10)
      if (isNaN(mins) || mins < 0 || mins > 1440) {
        setCompleting(false)
        return
      }
      confirmedSeconds = mins * 60
    } else {
      confirmedSeconds = finishModalSeconds
    }

    if (Math.round(confirmedSeconds / 60) === 0) {
      await returnTaskToPlan(finishModalTaskId)
      return
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === finishModalTaskId
          ? {
              ...t,
              status: 'completed' as const,
              timerStartedAt: null,
              accumulatedSeconds: 0,
              timeSpentMinutes:
                confirmedSeconds !== undefined
                  ? Math.round((confirmedSeconds / 60) * 100) / 100
                  : t.timeSpentMinutes,
            }
          : t,
      ),
    )

    const taskId = finishModalTaskId
    setFinishModalTaskId(null)
    setCompleting(false)

    const result = await completeTaskAction(taskId, confirmedSeconds)

    if (result.error) {
      setTasks(stableTasksRef.current)
      return
    }

    setTasks((current) => {
      stableTasksRef.current = current
      return current
    })

    if (result.enrollmentFinished) {
      toast.success(`Congratulations! You finished ${result.enrollmentFinished}.`)
    }
  }

  async function handleFinished() {
    setFinishing(true)
    const result = await finishedForTodayAction()
    setFinishing(false)
    if (!result.error) {
      setTasks([])
      setFinishedOpen(false)
    }
  }

  async function handleAutoPopulate() {
    setAutoPopulating(true)
    const result = await autoPopulateAction(autoPopulateCount)
    setAutoPopulating(false)
    setAutoPopulateOpen(false)
    if (!result.error) router.refresh()
  }

  function handleTaskUpdated(
    playerTaskId: string,
    changes: { title: string; description: string; resourceUrl: string },
  ) {
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === playerTaskId
          ? {
              ...t,
              title: changes.title,
              description: changes.description || null,
              resourceUrl: changes.resourceUrl || null,
            }
          : t,
      )
      stableTasksRef.current = next
      return next
    })
  }

  async function handleRemove(playerTaskId: string) {
    setRemoving(true)
    setTasks((prev) => prev.filter((t) => t.id !== playerTaskId))
    const result = await removeTaskAction(playerTaskId)
    setRemoving(false)
    if (result.error) {
      setTasks(stableTasksRef.current)
    } else {
      setTasks((current) => {
        stableTasksRef.current = current
        return current
      })
    }
  }

  return (
    <>
      <div className="today-header-strip">
        <hgroup>
          <h1>To Do Today</h1>
          <p>Your to do list for today.</p>
        </hgroup>
        {hasTasks && (
          <div className="strip-right">
            {isGuide && (
              <label className="edit-mode-toggle">
                <input
                  type="checkbox"
                  role="switch"
                  checked={editMode}
                  onChange={(e) => setEditMode(e.target.checked)}
                  aria-label="Toggle edit mode"
                />
                Edit Mode
              </label>
            )}
            <IconKey />
          </div>
        )}
      </div>

      {hasTasks ? (
        <>
          <StatCards
            completedCount={completedCount}
            totalCount={totalCount}
            timeSpentMinutes={timeSpentMinutes}
          />

          <div aria-live="polite" aria-atomic="true">
            {saving && (
              <p style={{ textAlign: 'center' }}>Saving order…</p>
            )}
          </div>

          <DndContext
            id="today-tasks"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ol className="task-list" aria-label="Today's task list">
                {tasks.map((task, index) => (
                  <li key={task.id}>
                    <SortableTaskCard
                      task={task}
                      index={index}
                      total={tasks.length}
                      onMoveUp={(i) => moveItem(i, i - 1)}
                      onMoveDown={(i) => moveItem(i, i + 1)}
                      onStart={handleStart}
                      onPause={handlePause}
                      onUnpause={handleUnpause}
                      onFinish={handleOpenFinishModal}
                      onRemove={handleRemove}
                      onTaskUpdated={handleTaskUpdated}
                      starting={starting}
                      pausing={pausing}
                      removing={removing}
                      canRemove={isGuide && editMode}
                    />
                  </li>
                ))}
              </ol>
            </SortableContext>
          </DndContext>

          <div className="finished-cta">
            <button className="outline" onClick={() => setFinishedOpen(true)}>
              Finished for Today?
            </button>
          </div>
        </>
      ) : (
        <EmptyState
          hasActiveEnrollments={hasActiveEnrollments}
          onAutoPopulate={() => setAutoPopulateOpen(true)}
        />
      )}

      {/* Duration Confirmation Dialog */}
      <dialog ref={durationDialogRef}>
        <article>
          <header>
            <h3>{finishModalScreen === 1 ? "How'd it go?" : "Let's correct that"}</h3>
          </header>
          {finishModalError && (
            <p role="alert" style={{ color: 'var(--pico-del-color)' }}>
              {finishModalError}
            </p>
          )}
          {finishModalScreen === 1 ? (
            <>
              <p>
                You spent{' '}
                <strong>{formatTime(Math.round(finishModalSeconds / 60))}</strong> on this task.
                Is that accurate?
              </p>
              <footer>
                <button className="secondary" onClick={() => setFinishModalTaskId(null)}>
                  Cancel
                </button>
                <button className="outline" onClick={() => setFinishModalScreen(2)}>
                  No
                </button>
                <button onClick={() => handleConfirmFinish(true)} disabled={completing}>
                  {completing
                    ? 'Saving…'
                    : Math.round(finishModalSeconds / 60) === 0
                      ? 'Yes, Return to Plan'
                      : 'Yes'}
                </button>
              </footer>
            </>
          ) : (
            <>
              <p>How many minutes did you actually spend?</p>
              <label>
                Minutes spent
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={correctedMinutes}
                  onChange={(e) => setCorrectedMinutes(e.target.value)}
                  aria-label="Minutes spent"
                />
              </label>
              <footer>
                <button className="secondary" onClick={() => setFinishModalTaskId(null)}>
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmFinish(false)}
                  disabled={
                    completing ||
                    correctedMinutes === '' ||
                    parseInt(correctedMinutes, 10) < 0 ||
                    parseInt(correctedMinutes, 10) > 1440
                  }
                >
                  {completing ? 'Saving…' : 'Confirm'}
                </button>
              </footer>
            </>
          )}
        </article>
      </dialog>

      {/* Finished for Today Dialog */}
      <dialog ref={finishedDialogRef}>
        <article>
          <header>
            <h3>Finished for Today?</h3>
          </header>
          <p>
            You completed {completedCount} {completedCount === 1 ? 'task' : 'tasks'} today.
            {unfinishedCount > 0
              ? ` ${unfinishedCount} unfinished ${unfinishedCount === 1 ? 'task' : 'tasks'} will return to Plan.`
              : ' All tasks are complete. Your list will be cleared.'}
          </p>
          {hasRunningTimer && (
            <p role="alert" style={{ color: 'var(--pico-del-color)', fontWeight: 600 }}>
              ⚠ A timer is still running. Finish or pause it first.
            </p>
          )}
          <footer>
            <button className="secondary" onClick={() => setFinishedOpen(false)}>
              Cancel
            </button>
            <button onClick={handleFinished} disabled={finishing || hasRunningTimer}>
              {finishing ? 'Clearing…' : "Yes, I'm Done"}
            </button>
          </footer>
        </article>
      </dialog>

      {/* Auto-Populate Dialog */}
      <dialog ref={autoPopulateDialogRef}>
        <article>
          <header>
            <h3>Auto-Populate Tasks</h3>
          </header>
          <p style={{ textAlign: 'center' }}>How many tasks will you do today?</p>
          <label>
            Number of tasks
            <select
              value={autoPopulateCount}
              onChange={(e) => setAutoPopulateCount(Number(e.target.value))}
              aria-label="Number of tasks"
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <footer>
            <button
              className="secondary"
              onClick={() => setAutoPopulateOpen(false)}
              disabled={autoPopulating}
            >
              Cancel
            </button>
            <button onClick={handleAutoPopulate} disabled={autoPopulating}>
              {autoPopulating ? 'Selecting tasks…' : 'Confirm'}
            </button>
          </footer>
        </article>
      </dialog>
    </>
  )
}
