'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addLearners } from './actions'
import { trackEvent } from '@/components/analytics'

type PlayerField = {
  firstName: string
  lastName: string
  username: string
  password: string
  error?: string
}

export function PlayersForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'ask' | 'count' | 'form'>('ask')
  const [count, setCount] = useState(0)
  const [players, setPlayers] = useState<PlayerField[]>([])
  const [formError, setFormError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSkipToNext() {
    router.push('/onboarding/curriculum')
  }

  function handleAddingPlayers() {
    setMode('count')
  }

  function handleCountConfirm() {
    if (count === 0) {
      handleSkipToNext()
      return
    }
    const n = Math.min(count, 19)
    setPlayers(
      Array.from({ length: n }, () => ({
        firstName: '',
        lastName: '',
        username: '',
        password: '',
      })),
    )
    setMode('form')
  }

  function updatePlayer(
    index: number,
    field: 'firstName' | 'lastName' | 'username' | 'password',
    value: string,
  ) {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value, error: undefined } : p)),
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    startTransition(async () => {
      const result = await addLearners(
        players.map((p) => ({
          first_name: p.firstName.trim(),
          last_name: p.lastName.trim(),
          username: p.username.trim(),
          password: p.password,
        })),
      )

      if (result.error) {
        setFormError(result.error)
        return
      }

      if (result.results) {
        result.results
          .filter((r) => !r.error)
          .forEach(() => trackEvent('add_player', { source: 'onboarding' }))
        const hasErrors = result.results.some((r) => r.error)
        if (hasErrors) {
          setPlayers((prev) =>
            prev.map((p, i) => {
              const r = result.results!.find((res) => res.index === i)
              return r?.error ? { ...p, error: r.error } : p
            }),
          )
          return
        }
      }

      router.push('/onboarding/curriculum')
    })
  }

  if (mode === 'ask') {
    return (
      <article className="onboarding-card">
        <hgroup>
          <h1>Who will be learning?</h1>
          <p>
            Are you learning on your own, or will you be setting up other Players
            like your kids, students, or a club?
          </p>
        </hgroup>
        <div className="ask-choices">
          <button type="button" className="outline" onClick={handleSkipToNext}>
            Just me
          </button>
          <button type="button" className="outline" onClick={handleAddingPlayers}>
            I&apos;m setting up additional Players
          </button>
        </div>
      </article>
    )
  }

  if (mode === 'count') {
    return (
      <article className="onboarding-card">
        <hgroup>
          <h1>How many additional Players?</h1>
          <p>
            You are already set up as the first Player. Each additional Player
            gets their own username and password to log in.
          </p>
        </hgroup>

        <div className="count-stepper">
          <button
            type="button"
            className="outline"
            onClick={() => setCount((c) => Math.max(0, c - 1))}
            disabled={count <= 0}
            aria-label="Decrease count"
          >
            −
          </button>
          <span className="count-value" aria-live="polite">
            {count}
          </span>
          <button
            type="button"
            className="outline"
            onClick={() => setCount((c) => Math.min(19, c + 1))}
            disabled={count >= 19}
            aria-label="Increase count"
          >
            +
          </button>
        </div>

        <button type="button" onClick={handleCountConfirm}>
          Continue
        </button>

        <footer>
          <button type="button" className="onboarding-skip" onClick={handleSkipToNext}>
            I&apos;ll set up additional Players later
          </button>
        </footer>
      </article>
    )
  }

  // mode === 'form'
  return (
    <article className="onboarding-card">
      <hgroup>
        <h1>Set up your Players</h1>
        <p>Create a username and password for each Player.</p>
      </hgroup>

      <form onSubmit={handleSubmit}>
        {players.map((player, idx) => (
          <fieldset key={idx} className="player-fieldset">
            <legend>Player {idx + 1}</legend>
            <div className="form-grid-2">
              <label>
                First name
                <input
                  id={`firstName-${idx}`}
                  value={player.firstName}
                  onChange={(e) => updatePlayer(idx, 'firstName', e.target.value)}
                  required
                />
              </label>
              <label>
                Last name
                <input
                  id={`lastName-${idx}`}
                  value={player.lastName}
                  onChange={(e) => updatePlayer(idx, 'lastName', e.target.value)}
                  required
                />
              </label>
            </div>
            <label>
              Username
              <input
                id={`username-${idx}`}
                value={player.username}
                onChange={(e) => updatePlayer(idx, 'username', e.target.value)}
                required
                minLength={3}
                maxLength={30}
                pattern="^[a-zA-Z0-9_-]+$"
                placeholder="letters, numbers, hyphens, underscores"
              />
            </label>
            <label>
              Password
              <input
                id={`password-${idx}`}
                type="password"
                value={player.password}
                onChange={(e) => updatePlayer(idx, 'password', e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </label>
            {player.error && (
              <p className="field-error" role="alert">
                {player.error}
              </p>
            )}
          </fieldset>
        ))}

        {formError && (
          <p className="form-alert" role="alert">
            {formError}
          </p>
        )}

        <button type="submit" disabled={isPending} aria-busy={isPending}>
          {isPending
            ? 'Creating Players…'
            : `Create ${players.length} Player${players.length !== 1 ? 's' : ''}`}
        </button>
      </form>

      <footer>
        <button type="button" className="onboarding-skip" onClick={handleSkipToNext}>
          I&apos;ll set up additional players later
        </button>
      </footer>
    </article>
  )
}
