'use client'

import { useState, useTransition } from 'react'
import {
  chooseCurriculumOnboarding,
  buildYourOwnOnboarding,
  skipCurriculumOnboarding,
} from './actions'

type Curriculum = {
  id: string
  name: string
  public_title?: string | null
  public_description?: string | null
  grade_level?: string | null
  tasks: { count: number }[]
}

export function CurriculumStep({
  curricula,
  isMobile,
}: {
  curricula: Curriculum[]
  isMobile: boolean
}) {
  const [mode, setMode] = useState<'choose' | 'browse'>('choose')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleChoose(curriculumId: string) {
    setError('')
    startTransition(async () => {
      const result = await chooseCurriculumOnboarding(curriculumId)
      if (result?.error) setError(result.error)
    })
  }

  function handleBuildYourOwn() {
    setError('')
    startTransition(async () => {
      const result = await buildYourOwnOnboarding(isMobile)
      if (result?.error) setError(result.error)
    })
  }

  function handleSkip() {
    startTransition(async () => {
      await skipCurriculumOnboarding()
    })
  }

  if (mode === 'choose') {
    return (
      <article className="onboarding-card">
        <hgroup>
          <h1>Your first curriculum</h1>
          <p>
            Pick a pre-made curriculum to get started right away, or build your own.
          </p>
        </hgroup>

        <div className="ask-choices choice-rich">
          {curricula.length > 0 && (
            <button
              type="button"
              className="outline"
              onClick={() => setMode('browse')}
              disabled={isPending}
            >
              <strong>Browse curriculums</strong>
              <small>Pick from our hand-selected collection.</small>
            </button>
          )}
          <button
            type="button"
            className="outline"
            onClick={handleBuildYourOwn}
            disabled={isPending}
          >
            <strong>Build your own</strong>
            <small>
              {isMobile
                ? 'Start a curriculum on your phone and add to it later.'
                : 'Upload a CSV file with your curriculum and tasks.'}
            </small>
          </button>
        </div>

        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}

        <footer>
          <button
            type="button"
            className="onboarding-skip"
            onClick={handleSkip}
            disabled={isPending}
          >
            I&apos;ll do this later
          </button>
        </footer>
      </article>
    )
  }

  // mode === 'browse'
  return (
    <article className="onboarding-card">
      <p className="back-link">
        <button
          type="button"
          className="onboarding-skip"
          onClick={() => setMode('choose')}
        >
          ← Back
        </button>
      </p>
      <hgroup>
        <h1>Browse curriculums</h1>
        <p>Pick one to add it to your account. You can always add more later.</p>
      </hgroup>

      <ul className="curriculum-list">
        {curricula.map((c) => {
          const title = c.public_title || c.name
          const taskCount = c.tasks?.[0]?.count ?? 0
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => handleChoose(c.id)}
                disabled={isPending}
              >
                <strong>{title}</strong>
                <small>
                  {taskCount > 0 && <>{taskCount} tasks</>}
                  {taskCount > 0 && c.grade_level && <> · </>}
                  {c.grade_level}
                </small>
                {c.public_description && <p>{c.public_description}</p>}
              </button>
            </li>
          )
        })}
      </ul>

      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}
