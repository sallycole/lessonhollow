'use client'

import { useActionState } from 'react'
import { createCurriculumAction, type CurriculumActionState } from './actions'
import { GRADE_LEVELS } from '@/lib/constants'

const initialState: CurriculumActionState = {}

export function CurriculumForm() {
  const [state, formAction, pending] = useActionState(
    createCurriculumAction,
    initialState
  )

  return (
    <article className="curriculum-form-card">
      <form action={formAction}>
        <label htmlFor="name">
          Name <span className="required-marker">*</span>
          <input
            id="name"
            name="name"
            required
            placeholder="e.g. Saxon Math 5/4"
            maxLength={200}
          />
          {state.fieldErrors?.name && (
            <p className="field-error">{state.fieldErrors.name[0]}</p>
          )}
        </label>

        <label htmlFor="description">
          Description
          <textarea
            id="description"
            name="description"
            placeholder="Brief description of this curriculum"
            rows={3}
            maxLength={2000}
          />
          {state.fieldErrors?.description && (
            <p className="field-error">{state.fieldErrors.description[0]}</p>
          )}
        </label>

        <label htmlFor="resource_url">
          Resource URL
          <input
            id="resource_url"
            name="resource_url"
            type="url"
            placeholder="https://example.com/textbook"
          />
          {state.fieldErrors?.resource_url && (
            <p className="field-error">{state.fieldErrors.resource_url[0]}</p>
          )}
        </label>

        <div className="form-grid-2">
          <label htmlFor="publisher">
            Publisher
            <input
              id="publisher"
              name="publisher"
              placeholder="e.g. Saxon Publishers"
              maxLength={200}
            />
            {state.fieldErrors?.publisher && (
              <p className="field-error">{state.fieldErrors.publisher[0]}</p>
            )}
          </label>

          <label htmlFor="grade_level">
            Grade Level
            <select id="grade_level" name="grade_level" defaultValue="">
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
          <button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Creating…' : 'Create Curriculum'}
          </button>
        </footer>
      </form>
    </article>
  )
}
