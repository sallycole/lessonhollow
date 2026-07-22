'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { requestPasswordReset, type ForgotPasswordState } from './actions'

const initialState: ForgotPasswordState = {}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState)
  const searchParams = useSearchParams()
  const prefillEmail = searchParams.get('email') ?? ''

  if (state.submitted) {
    return (
      <article className="auth-card">
        <hgroup>
          <h1>Check your email</h1>
          <p>
            If an account exists with that email, we&apos;ve sent a password reset link.
            Check your inbox and spam folder.
          </p>
        </hgroup>
        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--pico-muted-color)' }}>
          Didn&apos;t receive it? Check your spam folder or{' '}
          <button
            type="button"
            className="auth-inline-action"
            onClick={() => window.location.reload()}
          >
            try again
          </button>
          .
        </p>
        <footer>
          <Link href="/login">Back to login</Link>
        </footer>
      </article>
    )
  }

  return (
    <article className="auth-card">
      <hgroup>
        <h1>Reset your password</h1>
        <p>Enter your email and we&apos;ll send you a link to reset your password.</p>
      </hgroup>

      <form action={formAction}>
        <label>
          Email
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={prefillEmail}
          />
        </label>

        {state.error && (
          <p className="auth-alert" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <footer>
        <span>
          Remember your password? <Link href="/login">Log in</Link>
        </span>
      </footer>
    </article>
  )
}
