'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { GRADE_LEVELS, ACTION_TYPES } from '@/lib/constants'
import { updateCurriculumAction } from '../../actions'
import { createTaskAction, type TaskActionState } from './actions'
import { TaskList } from './task-list'

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
  action_type: string
  position: number
}

const taskInitialState: TaskActionState = {}

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

export function FinalizeClient({
  curriculum,
  tasks,
}: {
  curriculum: Curriculum
  tasks: Task[]
}) {
  const router = useRouter()
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const metaFormRef = useRef<HTMLFormElement>(null)

  const boundTaskAction = createTaskAction.bind(null, curriculum.id)
  const [taskState, taskFormAction, taskPending] = useActionState(boundTaskAction, taskInitialState)
  const taskFormRef = useRef<HTMLFormElement>(null)
  const taskTitleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (taskState.success) {
      taskFormRef.current?.reset()
      taskTitleRef.current?.focus()
      router.refresh()
    }
  }, [taskState, router])

  const addTaskDialogRef = useNativeDialog(addTaskOpen, () => setAddTaskOpen(false))

  return (
    <div className="finalize-shell">
      <header className="finalize-header">
        <hgroup>
          <h1>Finalize Upload</h1>
          <p>Review your curriculum details and tasks before saving.</p>
        </hgroup>
        <button
          type="button"
          onClick={async () => {
            if (metaFormRef.current) {
              const formData = new FormData(metaFormRef.current)
              await updateCurriculumAction(curriculum.id, {}, formData)
            }
            router.push(`/curriculums/${curriculum.id}`)
          }}
        >
          Save
        </button>
      </header>

      <form ref={metaFormRef} className="finalize-meta-form">
        <label htmlFor="meta-name">
          Title <span className="required-marker">*</span>
          <input
            id="meta-name"
            name="name"
            required
            defaultValue={curriculum.name}
            maxLength={200}
          />
        </label>

        <label htmlFor="meta-description">
          Description
          <textarea
            id="meta-description"
            name="description"
            defaultValue={curriculum.description ?? ''}
            rows={3}
            maxLength={2000}
          />
        </label>

        <label htmlFor="meta-resource_url">
          Resource URL
          <input
            id="meta-resource_url"
            name="resource_url"
            type="url"
            defaultValue={curriculum.resource_url ?? ''}
            placeholder="https://example.com/textbook"
          />
        </label>

        <div className="form-grid-2">
          <label htmlFor="meta-publisher">
            Publisher
            <input
              id="meta-publisher"
              name="publisher"
              defaultValue={curriculum.publisher ?? ''}
              placeholder="e.g. Saxon Publishers"
              maxLength={200}
            />
          </label>

          <label htmlFor="meta-grade_level">
            Grade Level
            <select
              id="meta-grade_level"
              name="grade_level"
              defaultValue={curriculum.grade_level ?? ''}
            >
              <option value="">Select grade level</option>
              {GRADE_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
        </div>
      </form>

      <TaskList
        key={tasks.length}
        curriculumId={curriculum.id}
        initialTasks={tasks}
        headerAction={
          <button
            type="button"
            className="outline"
            onClick={() => setAddTaskOpen(true)}
          >
            <Plus size={14} /> Add Task
          </button>
        }
      />

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
    </div>
  )
}
