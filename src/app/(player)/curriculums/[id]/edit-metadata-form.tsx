'use client'

import { useActionState, useEffect } from 'react'
import { updateCurriculumAction, type UpdateCurriculumState } from './actions'
import { GRADE_LEVELS } from '@/lib/constants'

type Curriculum = {
  id: string
  name: string
  description: string | null
  resource_url: string | null
  publisher: string | null
  grade_level: string | null
}

const initialState: UpdateCurriculumState = {}

export function EditMetadataForm({
  curriculum,
  onCancel,
  onSaved,
}: {
  curriculum: Curriculum
  onCancel: () => void
  onSaved: () => void
}) {
  const boundAction = updateCurriculumAction.bind(null, curriculum.id)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  useEffect(() => {
    if (state.success) onSaved()
  }, [state.success, onSaved])

  return (
    <article className="metadata-edit-card">
      <header>
        <h3>Edit Details</h3>
      </header>
      <form key={curriculum.id} action={formAction}>
        <label htmlFor="edit-name">
          Name <span className="required-marker">*</span>
          <input
            id="edit-name"
            name="name"
            required
            defaultValue={curriculum.name}
            maxLength={200}
          />
          {state.fieldErrors?.name && (
            <p className="field-error">{state.fieldErrors.name[0]}</p>
          )}
        </label>

        <label htmlFor="edit-description">
          Description
          <textarea
            id="edit-description"
            name="description"
            defaultValue={curriculum.description ?? ''}
            rows={3}
            maxLength={2000}
          />
          {state.fieldErrors?.description && (
            <p className="field-error">{state.fieldErrors.description[0]}</p>
          )}
        </label>

        <label htmlFor="edit-resource_url">
          Resource URL
          <input
            id="edit-resource_url"
            name="resource_url"
            type="url"
            defaultValue={curriculum.resource_url ?? ''}
            placeholder="https://example.com/textbook"
          />
          {state.fieldErrors?.resource_url && (
            <p className="field-error">{state.fieldErrors.resource_url[0]}</p>
          )}
        </label>

        <div className="form-grid-2">
          <label htmlFor="edit-publisher">
            Publisher
            <input
              id="edit-publisher"
              name="publisher"
              defaultValue={curriculum.publisher ?? ''}
              placeholder="e.g. Saxon Publishers"
              maxLength={200}
            />
            {state.fieldErrors?.publisher && (
              <p className="field-error">{state.fieldErrors.publisher[0]}</p>
            )}
          </label>

          <label htmlFor="edit-grade_level">
            Grade Level
            <select
              id="edit-grade_level"
              name="grade_level"
              defaultValue={curriculum.grade_level ?? ''}
            >
              <option value="">Select grade level</option>
              {GRADE_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            {state.fieldErrors?.grade_level && (
              <p className="field-error">{state.fieldErrors.grade_level[0]}</p>
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
            {pending ? 'Saving…' : 'Save Changes'}
          </button>
        </footer>
      </form>
    </article>
  )
}
