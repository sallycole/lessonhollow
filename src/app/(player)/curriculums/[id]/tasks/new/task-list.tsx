'use client'

import { useState, useCallback } from 'react'
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
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { reorderTasksAction } from './actions'

type Task = {
  id: string
  title: string
  action_type: string
  position: number
}

function SortableTask({
  task,
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  task: Task
  index: number
  total: number
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="finalize-task-row"
      data-dragging={isDragging || undefined}
    >
      <button
        type="button"
        className="icon-button drag-handle"
        aria-label={`Drag to reorder ${task.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

      <span className="task-index">{index + 1}.</span>
      <span className="task-title-text">{task.title}</span>
      <span className="action-badge">{task.action_type}</span>

      <div className="task-move-actions">
        <button
          type="button"
          className="icon-button"
          disabled={index === 0}
          onClick={() => onMoveUp(index)}
          aria-label={`Move ${task.title} up`}
        >
          <ArrowUp size={12} />
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={index === total - 1}
          onClick={() => onMoveDown(index)}
          aria-label={`Move ${task.title} down`}
        >
          <ArrowDown size={12} />
        </button>
      </div>
    </li>
  )
}

export function TaskList({
  curriculumId,
  initialTasks,
  headerAction,
}: {
  curriculumId: string
  initialTasks: Task[]
  headerAction?: React.ReactNode
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const persistOrder = useCallback(
    async (reordered: Task[]) => {
      const updates: Array<{ id: string; position: number }> = []
      reordered.forEach((task, i) => {
        const newPosition = (i + 1) * 10
        if (task.position !== newPosition) {
          updates.push({ id: task.id, position: newPosition })
        }
      })

      if (updates.length === 0) return

      setSaving(true)
      setError(null)
      const result = await reorderTasksAction(curriculumId, updates)
      setSaving(false)

      if (result.error) {
        setError(result.error)
      } else {
        setTasks((prev) => prev.map((t, i) => ({ ...t, position: (i + 1) * 10 })))
      }
    },
    [curriculumId]
  )

  const moveItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      setTasks((prev) => {
        const reordered = arrayMove(prev, fromIndex, toIndex)
        persistOrder(reordered)
        return reordered
      })
    },
    [persistOrder]
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex((t) => t.id === active.id)
    const newIndex = tasks.findIndex((t) => t.id === over.id)
    moveItem(oldIndex, newIndex)
  }

  if (tasks.length === 0) return null

  return (
    <div className="finalize-task-list">
      <header>
        <div className="task-list-title">
          <h3>{tasks.length} task{tasks.length !== 1 ? 's' : ''} added</h3>
          {saving && <span>Saving…</span>}
        </div>
        {headerAction}
      </header>

      {error && (
        <p className="form-error" role="alert">{error}</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ol aria-label="Task list">
            {tasks.map((task, index) => (
              <SortableTask
                key={task.id}
                task={task}
                index={index}
                total={tasks.length}
                onMoveUp={(i) => moveItem(i, i - 1)}
                onMoveDown={(i) => moveItem(i, i + 1)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  )
}
