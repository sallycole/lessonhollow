'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { login, resendConfirmation, type LoginState } from './actions'

const initialState: LoginState = {}

export function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? ''
  const prefillEmail = searchParams.get('email') ?? ''
  const message = searchParams.get('message')

  const [identifier, setIdentifier] = useState(prefillEmail)
  const [resendState, setResendState] = useState<{ sent?: boolean; error?: string }>({})
  const [resending, setResending] = useState(false)

  const [state, formAction, pending] = useActionState(login, initialState)

  const showGuideLinks = !identifier || identifier.includes('@')

  async function handleResendConfirmation() {
    setResending(true)
    const result = await resendConfirmation(identifier)
    if (result.error) setResendState({ error: result.error })
    else setResendState({ sent: true })
    setResending(false)
  }

  return (
    <article className="auth-card">
      <hgroup>
        <h1>Welcome back</h1>
      </hgroup>

      {message === 'password-reset' && (
        <p className="auth-status" role="status">
          Your password has been reset successfully. Please log in.
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <label>
          Email or username
          <input
            id="identifier"
            name="identifier"
            type="text"
            required
            autoFocus
            autoComplete="username email"
            placeholder="you@example.com or username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </label>

        <label>
          Password
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>

        {state.error && (
          <div role="alert">
            <p className="auth-alert">{state.error}</p>
            {state.emailNotConfirmed && showGuideLinks && (
              <button
                type="button"
                className="auth-inline-action"
                onClick={handleResendConfirmation}
                disabled={resending}
              >
                {resending ? 'Sending…' : 'Resend confirmation email'}
              </button>
            )}
          </div>
        )}

        {resendState.sent && (
          <p className="auth-alert-success" role="status">
            Confirmation email sent. Check your inbox.
          </p>
        )}
        {resendState.error && (
          <p className="auth-alert" role="alert">
            {resendState.error}
          </p>
        )}

        <button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      {showGuideLinks && (
        <footer>
          <Link
            href={
              identifier
                ? `/forgot-password?email=${encodeURIComponent(identifier)}`
                : '/forgot-password'
            }
          >
            Forgot your password?
          </Link>
          <span>
            Don&apos;t have an account?{' '}
            <Link href="/signup">Sign up</Link>
          </span>
        </footer>
      )}
    </article>
  )
}
