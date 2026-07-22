'use client'

import { useState, useCallback, useRef, useActionState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  Check,
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  GripVertical,
  MinusCircle,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { EditMetadataForm } from './edit-metadata-form'
import { EditTaskForm } from './edit-task-form'
import {
  deleteCurriculumAction,
  deleteTaskAction,
  type DeleteCurriculumState,
} from './actions'
import { createTaskAction, reorderTasksAction, type TaskActionState } from './tasks/new/actions'
import { ACTION_TYPES } from '@/lib/constants'

type Curriculum = {
  id: string
  name: string
  description: string | null
  resource_url: string | null
  publisher: string | null
  grade_level: string | null
}

type Task = {
  id: string
  title: string
  description: string | null
  action_type: string
  resource_url: string | null
  player_status?: 'pending' | 'completed' | 'skipped' | 'promoted'
}

const STATUS_INDICATORS: Record<string, { icon: React.ReactNode; label: string }> = {
  completed: {
    icon: <CheckCircle2 size={16} className="status-completed" aria-hidden="true" />,
    label: 'Completed',
  },
  skipped: {
    icon: <MinusCircle size={16} className="status-skipped" aria-hidden="true" />,
    label: 'Skipped',
  },
  pending: {
    icon: <Circle size={16} className="status-pending" aria-hidden="true" />,
    label: 'Pending',
  },
  promoted: {
    icon: <CheckCircle2 size={16} className="status-promoted" aria-hidden="true" />,
    label: 'Promoted',
  },
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

function SortableTaskRow({
  task,
  hasStatus,
  editingTaskId,
  curriculumId,
  onEditTask,
  onTaskCancel,
  onTaskSaved,
}: {
  task: Task
  hasStatus: boolean
  editingTaskId: string | null
  curriculumId: string
  onEditTask: (id: string) => void
  onTaskCancel: () => void
  onTaskSaved: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (editingTaskId === task.id) {
    return (
      <li ref={setNodeRef} style={style} className="task-row editing">
        <EditTaskForm
          task={task}
          curriculumId={curriculumId}
          onCancel={onTaskCancel}
          onSaved={onTaskSaved}
        />
      </li>
    )
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="task-row"
      data-dragging={isDragging || undefined}
    >
      <div className="task-row-leading">
        <button
          type="button"
          className="icon-button drag-handle"
          aria-label={`Drag to reorder ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        {hasStatus && task.player_status && (
          <span className="task-status" title={STATUS_INDICATORS[task.player_status]?.label}>
            {STATUS_INDICATORS[task.player_status]?.icon}
            <span className="visually-hidden">{STATUS_INDICATORS[task.player_status]?.label}</span>
          </span>
        )}
      </div>
      <div className="task-row-body">
        <div className="task-title-row">
          <span className="action-badge">{task.action_type}</span>
          <strong className="task-title">{task.title}</strong>
          {task.resource_url && (
            <a
              href={task.resource_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open resource"
              className="task-resource"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        {task.description && <p className="task-description">{task.description}</p>}
      </div>
      <div className="task-row-actions">
        <button
          type="button"
          className="icon-button"
          onClick={() => onEditTask(task.id)}
          aria-label={`Edit ${task.title}`}
        >
          <Pencil size={14} />
        </button>
        <DeleteTaskButton taskId={task.id} taskTitle={task.title} curriculumId={curriculumId} />
      </div>
    </li>
  )
}

export function CurriculumDetails({
  curriculum,
  tasks,
  isEnrolled = false,
}: {
  curriculum: Curriculum
  tasks: Task[]
  isEnrolled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [readinessOpen, setReadinessOpen] = useState(false)
  const [orderedTasks, setOrderedTasks] = useState(tasks)
  useEffect(() => {
    setOrderedTasks(tasks)
  }, [tasks])
  const [reorderSaving, setReorderSaving] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const router = useRouter()
  const hasStatus = tasks.some((t) => t.player_status !== undefined)

  const enrollIssues: string[] = []
  if (!curriculum.name.trim()) enrollIssues.push('Curriculum needs a name')
  if (tasks.length === 0) enrollIssues.push('Add at least one task before enrolling')

  const boundDeleteAction = deleteCurriculumAction.bind(null, curriculum.id)
  const [deleteState, deleteAction, isDeleting] = useActionState(
    boundDeleteAction,
    {} as DeleteCurriculumState
  )

  const boundTaskAction = createTaskAction.bind(null, curriculum.id)
  const [taskState, taskFormAction, taskPending] = useActionState(boundTaskAction, {} as TaskActionState)
  const taskFormRef = useRef<HTMLFormElement>(null)
  const taskTitleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (taskState.success) {
      taskFormRef.current?.reset()
      taskTitleRef.current?.focus()
      router.refresh()
    }
  }, [taskState, router])

  const readinessDialogRef = useNativeDialog(readinessOpen, () => setReadinessOpen(false))
  const addTaskDialogRef = useNativeDialog(addTaskOpen, () => setAddTaskOpen(false))
  const deleteDialogRef = useNativeDialog(deleteDialogOpen, () => setDeleteDialogOpen(false))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      setOrderedTasks((prev) => {
        const oldIndex = prev.findIndex((t) => t.id === active.id)
        const newIndex = prev.findIndex((t) => t.id === over.id)
        const reordered = arrayMove(prev, oldIndex, newIndex)

        const updates: Array<{ id: string; position: number }> = []
        reordered.forEach((task, i) => {
          updates.push({ id: task.id, position: (i + 1) * 10 })
        })
        setReorderSaving(true)
        reorderTasksAction(curriculum.id, updates).then(() => {
          setReorderSaving(false)
        })

        return reordered
      })
    },
    [curriculum.id]
  )

  const handleSaved = useCallback(() => {
    setEditing(false)
    router.refresh()
  }, [router])

  const handleCancel = useCallback(() => setEditing(false), [])
  const handleTaskSaved = useCallback(() => {
    setEditingTaskId(null)
    router.refresh()
  }, [router])
  const handleTaskCancel = useCallback(() => setEditingTaskId(null), [])

  return (
    <div className="curriculum-detail-shell">
      <header className="detail-header">
        <hgroup>
          <h1>{curriculum.name}</h1>
        </hgroup>
        <div className="detail-header-actions">
          {isEnrolled ? (
            <span className="enrolled-badge">
              <Check size={14} /> Enrolled
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (enrollIssues.length > 0) {
                  setReadinessOpen(true)
                } else {
                  router.push(`/curriculums/${curriculum.id}/enroll`)
                }
              }}
            >
              Enroll
            </button>
          )}
        </div>
      </header>

      {/* Metadata — view or edit mode */}
      {editing ? (
        <EditMetadataForm
          curriculum={curriculum}
          onCancel={handleCancel}
          onSaved={handleSaved}
        />
      ) : (
        <article className="metadata-card">
          <dl>
            <div className="metadata-row metadata-row-full">
              <dt>Description</dt>
              <dd>{curriculum.description || <span className="dash">—</span>}</dd>
            </div>
            <div className="metadata-row metadata-row-full">
              <dt>Resource</dt>
              <dd>
                {curriculum.resource_url ? (
                  <a href={curriculum.resource_url} target="_blank" rel="noopener noreferrer">
                    {curriculum.resource_url} <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="dash">—</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="metadata-foot">
            <div className="metadata-foot-cell">
              <dt>Publisher</dt>
              <dd>{curriculum.publisher || <span className="dash">—</span>}</dd>
            </div>
            <div className="metadata-foot-cell">
              <dt>Grade Level</dt>
              <dd>{curriculum.grade_level || <span className="dash">—</span>}</dd>
            </div>
            <button
              type="button"
              className="outline edit-details-btn"
              onClick={() => setEditing(true)}
            >
              <Pencil size={14} /> Edit Details
            </button>
          </div>
        </article>
      )}

      {/* Task list card */}
      <article className="tasks-card">
        <header>
          <div className="tasks-card-title">
            <h3>Tasks</h3>
            {tasks.length > 0 && (
              <span>
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                {hasStatus && (() => {
                  const completed = tasks.filter((t) => t.player_status === 'completed').length
                  return ` · ${completed} completed`
                })()}
              </span>
            )}
          </div>
          <div className="tasks-card-actions">
            {reorderSaving && <span>Saving…</span>}
            <button type="button" className="outline" onClick={() => setAddTaskOpen(true)}>
              <Plus size={14} /> Add Task
            </button>
          </div>
        </header>

        {orderedTasks.length === 0 ? (
          <p className="tasks-empty">This curriculum has no tasks yet.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ol className="task-list">
                {orderedTasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    hasStatus={hasStatus}
                    editingTaskId={editingTaskId}
                    curriculumId={curriculum.id}
                    onEditTask={setEditingTaskId}
                    onTaskCancel={handleTaskCancel}
                    onTaskSaved={handleTaskSaved}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </article>

      {/* Bottom actions */}
      <div className="detail-bottom-actions">
        <a href={`/api/curriculums/${curriculum.id}/export`} download role="button" className="outline">
          <Download size={14} /> Export CSV
        </a>
        <button
          type="button"
          className="outline danger-button"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      {/* Readiness dialog */}
      <dialog ref={readinessDialogRef}>
        <article>
          <header>
            <h3>Not ready to enroll</h3>
            <p>This curriculum needs a few things before enrollment:</p>
          </header>
          <ul>
            {enrollIssues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
          <footer>
            <button type="button" className="secondary" onClick={() => setReadinessOpen(false)}>
              OK
            </button>
          </footer>
        </article>
      </dialog>

      {/* Add task dialog */}
      <dialog ref={addTaskDialogRef}>
        <article>
          <header>
            <h3>Add Task</h3>
          </header>
          {taskState.success && taskState.taskTitle && (
            <p className="form-success">Added &ldquo;{taskState.taskTitle}&rdquo;</p>
          )}
          <form ref={taskFormRef} action={taskFormAction}>
            <label htmlFor="task-title">
              Title <span className="required-marker">*</span>
              <input
                ref={taskTitleRef}
                id="task-title"
                name="title"
                required
                placeholder="e.g. Read Chapter 1"
                maxLength={500}
              />
              {taskState.fieldErrors?.title && (
                <p className="field-error">{taskState.fieldErrors.title[0]}</p>
              )}
            </label>

            <label htmlFor="task-description">
              Description
              <textarea
                id="task-description"
                name="description"
                placeholder="Optional details about this task"
                rows={2}
                maxLength={2000}
              />
              {taskState.fieldErrors?.description && (
                <p className="field-error">{taskState.fieldErrors.description[0]}</p>
              )}
            </label>

            <div className="form-grid-2">
              <label htmlFor="task-action_type">
                Action Type <span className="required-marker">*</span>
                <select id="task-action_type" name="action_type" required defaultValue="">
                  <option value="" disabled>Select action type</option>
                  {ACTION_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {taskState.fieldErrors?.action_type && (
                  <p className="field-error">{taskState.fieldErrors.action_type[0]}</p>
                )}
              </label>

              <label htmlFor="task-resource_url">
                Resource URL
                <input
                  id="task-resource_url"
                  name="resource_url"
                  type="url"
                  placeholder="https://example.com/resource"
                />
                {taskState.fieldErrors?.resource_url && (
                  <p className="field-error">{taskState.fieldErrors.resource_url[0]}</p>
                )}
              </label>
            </div>

            {tasks.length > 0 && (
              <label htmlFor="task-insert_after">
                Insert Position
                <select id="task-insert_after" name="insert_after" defaultValue="end">
                  <option value="end">At the end</option>
                  <option value="beginning">At the beginning</option>
                  {tasks.map((task, index) => (
                    <option key={task.id} value={task.id}>
                      After task {index + 1}: {task.title.length > 60 ? task.title.slice(0, 60) + '…' : task.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {taskState.error && !taskState.success && (
              <p className="form-error" role="alert">{taskState.error}</p>
            )}

            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setAddTaskOpen(false)}
              >
                Close
              </button>
              <button type="submit" disabled={taskPending} aria-busy={taskPending}>
                {taskPending ? 'Adding…' : 'Add Task'}
              </button>
            </footer>
          </form>
        </article>
      </dialog>

      {/* Delete dialog */}
      <dialog ref={deleteDialogRef}>
        <article>
          <header>
            <h3>Delete curriculum</h3>
            <p>
              This action is permanent and cannot be undone. Deleting
              &ldquo;{curriculum.name}&rdquo; will remove:
            </p>
          </header>
          <ul>
            <li>The curriculum and all its tasks</li>
            <li>All enrollments for this curriculum</li>
            <li>All completion and time records</li>
          </ul>
          {deleteState.error && (
            <p className="form-error">{deleteState.error}</p>
          )}
          <footer>
            <button
              type="button"
              className="secondary"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </button>
            <form action={deleteAction}>
              <button type="submit" className="contrast" disabled={isDeleting} aria-busy={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </form>
          </footer>
        </article>
      </dialog>
    </div>
  )
}

function DeleteTaskButton({
  taskId,
  taskTitle,
  curriculumId,
}: {
  taskId: string
  taskTitle: string
  curriculumId: string
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    if (!confirm(`Delete "${taskTitle}"?`)) return
    startTransition(async () => {
      const result = await deleteTaskAction(taskId, curriculumId)
      if (!result.error) {
        router.refresh()
      }
    })
  }

  return (
    <button
      type="button"
      className="icon-button danger"
      onClick={handleDelete}
      disabled={isPending}
      aria-label={`Delete ${taskTitle}`}
    >
      <Trash2 size={14} />
    </button>
  )
}
