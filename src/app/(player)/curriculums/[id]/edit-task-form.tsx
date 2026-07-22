'use client'

import { useActionState, useEffect } from 'react'
import { updateTaskAction, type UpdateTaskState } from './actions'
import { ACTION_TYPES } from '@/lib/constants'

type Task = {
  id: string
  title: string
  description: string | null
  action_type: string
  resource_url: string | null
}

const initialState: UpdateTaskState = {}

export function EditTaskForm({
  task,
  curriculumId,
  onCancel,
  onSaved,
}: {
  task: Task
  curriculumId: string
  onCancel: () => void
  onSaved: () => void
}) {
  const boundAction = updateTaskAction.bind(null, task.id, curriculumId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  useEffect(() => {
    if (state.success) onSaved()
  }, [state.success, onSaved])

  return (
    <form action={formAction} className="task-edit-form">
      <label htmlFor={`edit-task-title-${task.id}`}>
        Title <span className="required-marker">*</span>
        <input
          id={`edit-task-title-${task.id}`}
          name="title"
          required
          defaultValue={task.title}
          maxLength={500}
        />
        {state.fieldErrors?.title && (
          <p className="field-error">{state.fieldErrors.title[0]}</p>
        )}
      </label>

      <label htmlFor={`edit-task-description-${task.id}`}>
        Description
        <textarea
          id={`edit-task-description-${task.id}`}
          name="description"
          defaultValue={task.description ?? ''}
          rows={2}
          maxLength={2000}
        />
        {state.fieldErrors?.description && (
          <p className="field-error">{state.fieldErrors.description[0]}</p>
        )}
      </label>

      <div className="form-grid-2">
        <label htmlFor={`edit-task-action_type-${task.id}`}>
          Action Type
          <select
            id={`edit-task-action_type-${task.id}`}
            name="action_type"
            defaultValue={task.action_type}
          >
            {ACTION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          {state.fieldErrors?.action_type && (
            <p className="field-error">{state.fieldErrors.action_type[0]}</p>
          )}
        </label>

        <label htmlFor={`edit-task-resource_url-${task.id}`}>
          Resource URL
          <input
            id={`edit-task-resource_url-${task.id}`}
            name="resource_url"
            type="url"
            defaultValue={task.resource_url ?? ''}
            placeholder="https://example.com"
          />
          {state.fieldErrors?.resource_url && (
            <p className="field-error">{state.fieldErrors.resource_url[0]}</p>
          )}
        </label>
      </div>

      {state.error && (
        <p className="form-error" role="alert">{state.error}</p>
      )}

      <footer>
        <button type="button" className="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </footer>
    </form>
  )
}
