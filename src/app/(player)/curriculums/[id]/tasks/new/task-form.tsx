'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createTaskAction, type TaskActionState } from './actions'
import { ACTION_TYPES } from '@/lib/constants'

type ExistingTask = {
  id: string
  title: string
  position: number
}

const initialState: TaskActionState = {}

export function TaskForm({
  curriculumId,
  existingTasks = [],
}: {
  curriculumId: string
  existingTasks?: ExistingTask[]
}) {
  const boundAction = createTaskAction.bind(null, curriculumId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      titleRef.current?.focus()
    }
  }, [state])

  const taskCount = state.successCount ?? 0

  return (
    <div className="task-form-shell">
      {state.success && state.taskTitle && (
        <p className="form-success">
          Added &ldquo;{state.taskTitle}&rdquo; ({taskCount} task{taskCount !== 1 ? 's' : ''} added)
        </p>
      )}

      <article className="task-form-card">
        <form ref={formRef} action={formAction}>
          <label htmlFor="title">
            Title <span className="required-marker">*</span>
            <input
              ref={titleRef}
              id="title"
              name="title"
              required
              placeholder="e.g. Read Chapter 1"
              maxLength={500}
              autoFocus
            />
            {state.fieldErrors?.title && (
              <p className="field-error">{state.fieldErrors.title[0]}</p>
            )}
          </label>

          <label htmlFor="description">
            Description
            <textarea
              id="description"
              name="description"
              placeholder="Optional details about this task"
              rows={2}
              maxLength={2000}
            />
            {state.fieldErrors?.description && (
              <p className="field-error">{state.fieldErrors.description[0]}</p>
            )}
          </label>

          <div className="form-grid-2">
            <label htmlFor="action_type">
              Action Type <span className="required-marker">*</span>
              <select id="action_type" name="action_type" required defaultValue="">
                <option value="" disabled>Select action type</option>
                {ACTION_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {state.fieldErrors?.action_type && (
                <p className="field-error">{state.fieldErrors.action_type[0]}</p>
              )}
            </label>

            <label htmlFor="resource_url">
              Resource URL
              <input
                id="resource_url"
                name="resource_url"
                type="url"
                placeholder="https://example.com/resource"
              />
              {state.fieldErrors?.resource_url && (
                <p className="field-error">{state.fieldErrors.resource_url[0]}</p>
              )}
            </label>
          </div>

          {existingTasks.length > 0 && (
            <label htmlFor="insert_after">
              Insert Position
              <select id="insert_after" name="insert_after" defaultValue="end">
                <option value="end">At the end</option>
                <option value="beginning">At the beginning</option>
                {existingTasks.map((task, index) => (
                  <option key={task.id} value={task.id}>
                    After task {index + 1}: {task.title.length > 60 ? task.title.slice(0, 60) + '…' : task.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {state.error && !state.success && (
            <p className="form-error" role="alert">{state.error}</p>
          )}

          <footer>
            <button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? 'Adding…' : 'Add Task'}
            </button>
          </footer>
        </form>
      </article>
    </div>
  )
}
