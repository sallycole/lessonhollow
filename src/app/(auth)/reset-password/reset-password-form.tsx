'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updatePassword, type ResetPasswordState } from './actions'

const initialState: ResetPasswordState = {}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState)
  const router = useRouter()

  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => {
        router.push('/login?message=password-reset')
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [state.success, router])

  if (state.success) {
    return (
      <article className="auth-card">
        <hgroup>
          <h1>Password updated</h1>
          <p>Your password has been reset successfully. Redirecting to login…</p>
        </hgroup>
        <footer>
          <Link href="/login">Go to login</Link>
        </footer>
      </article>
    )
  }

  return (
    <article className="auth-card">
      <hgroup>
        <h1>Set new password</h1>
        <p>Enter your new password below.</p>
      </hgroup>

      <form action={formAction}>
        <label>
          New password
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
          />
          <small>Must be at least 8 characters.</small>
        </label>

        <label>
          Confirm new password
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
          />
        </label>

        {state.error && (
          <p className="auth-alert" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <footer>
        <Link href="/login">Back to login</Link>
      </footer>
    </article>
  )
}
