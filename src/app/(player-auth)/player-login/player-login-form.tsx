'use client'

import { useActionState } from 'react'
import { playerLogin, type PlayerLoginState } from './actions'

const initialState: PlayerLoginState = {}

export function PlayerLoginForm() {
  const [state, formAction, pending] = useActionState(playerLogin, initialState)

  return (
    <article className="player-login-card">
      <form action={formAction}>
        <label htmlFor="username">
          Your username
          <input
            id="username"
            name="username"
            type="text"
            required
            autoFocus
            autoComplete="username"
          />
        </label>

        <label htmlFor="password">
          Your password
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>

        <button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Logging in…' : "Let's go!"}
        </button>

        {state.error && (
          <p role="alert" className="player-login-error">{state.error}</p>
        )}
      </form>
    </article>
  )
}
