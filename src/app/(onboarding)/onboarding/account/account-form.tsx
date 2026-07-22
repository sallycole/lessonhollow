'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { timezones, detectTimezone } from '@/lib/timezones'
import { createAccountAndPlayer } from './actions'
import { trackEvent } from '@/components/analytics'

export function AccountForm() {
  const [selectedTimezone, setSelectedTimezone] = useState('')
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [formPending, setFormPending] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe browser API on mount; lazy-init useState would run server-side and mismatch
    setSelectedTimezone(detectTimezone(new Date().getTimezoneOffset()))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')
    setFieldErrors({})
    setFormPending(true)

    const formData = new FormData(e.currentTarget)
    formData.set('timezone', selectedTimezone)

    const result = await createAccountAndPlayer(formData)

    // Account exists even when needsPlayerRetry — that's still a sign-up
    if (!result?.error || result.needsPlayerRetry) {
      trackEvent('sign_up', { method: 'email' })
    }

    if (result?.error) {
      setFormError(result.fieldErrors ? '' : result.error)
      setFieldErrors(result.fieldErrors ?? {})
      setFormPending(false)
    }
  }

  return (
    <article className="onboarding-card">
      <hgroup>
        <h1>Create your account</h1>
        <p>Your account is also your Player profile.</p>
      </hgroup>

      <form onSubmit={handleSubmit}>
        <div className="form-grid-2">
          <label>
            First name
            <input
              id="firstName"
              name="firstName"
              required
              autoComplete="given-name"
              aria-invalid={fieldErrors.firstName ? 'true' : undefined}
            />
            {fieldErrors.firstName && (
              <p className="field-error">{fieldErrors.firstName[0]}</p>
            )}
          </label>
          <label>
            Last name
            <input
              id="lastName"
              name="lastName"
              required
              autoComplete="family-name"
              aria-invalid={fieldErrors.lastName ? 'true' : undefined}
            />
            {fieldErrors.lastName && (
              <p className="field-error">{fieldErrors.lastName[0]}</p>
            )}
          </label>
        </div>

        <label>
          Username
          <input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={30}
            pattern="^[a-zA-Z0-9_-]+$"
            placeholder="letters, numbers, hyphens, underscores"
            autoComplete="username"
            aria-invalid={fieldErrors.username ? 'true' : undefined}
          />
          {fieldErrors.username ? (
            <p className="field-error">{fieldErrors.username[0]}</p>
          ) : (
            <p className="field-hint">This is your Player login name.</p>
          )}
        </label>

        <label>
          Email
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={fieldErrors.email ? 'true' : undefined}
          />
          {fieldErrors.email && (
            <p className="field-error">{fieldErrors.email[0]}</p>
          )}
        </label>

        <label>
          Password
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            placeholder="At least 8 characters"
            aria-invalid={fieldErrors.password ? 'true' : undefined}
          />
          {fieldErrors.password && (
            <p className="field-error">{fieldErrors.password[0]}</p>
          )}
        </label>

        <label>
          Time zone
          <select
            id="timezone"
            value={selectedTimezone}
            onChange={(e) => setSelectedTimezone(e.target.value)}
            required
          >
            <option value="" disabled>
              Select time zone
            </option>
            {timezones.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </label>

        <p className="form-terms">
          By creating an account you agree to our <Link href="/terms">Terms of Service</Link>.
        </p>

        {formError && (
          <p className="form-alert" role="alert">
            {formError}
          </p>
        )}

        <button type="submit" disabled={formPending} aria-busy={formPending}>
          {formPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <footer>
        Already have an account? <Link href="/login">Log in</Link>
      </footer>
    </article>
  )
}
