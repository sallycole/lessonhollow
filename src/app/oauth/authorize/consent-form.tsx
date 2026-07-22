'use client'

import { useActionState } from 'react'
import { approveAuthorization, denyAuthorization } from './actions'

type Props = {
  clientName: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  state?: string
  scope?: string
  userId: string
}

export function ConsentForm({
  clientName,
  clientId,
  redirectUri,
  codeChallenge,
  state,
  scope,
  userId,
}: Props) {
  const [approveState, approveAction, approvePending] = useActionState(approveAuthorization, {})
  const [denyState, denyAction, denyPending] = useActionState(denyAuthorization, {})

  const error = approveState.error || denyState.error

  return (
    <article className="oauth-card">
      <hgroup>
        <h1>Authorize Access</h1>
        <p>
          <strong>{clientName}</strong> wants to access your Lesson Hollow account.
        </p>
      </hgroup>

      <details open>
        <summary>This will allow {clientName} to:</summary>
        <ul>
          <li>Manage your Players and their accounts</li>
          <li>Create and edit curriculums and tasks</li>
          <li>Manage enrollments and daily workflow</li>
          <li>View learning history and progress</li>
        </ul>
      </details>

      {error && (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      )}

      <div className="oauth-actions">
        <form action={denyAction}>
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          {state && <input type="hidden" name="state" value={state} />}
          <button
            type="submit"
            className="secondary"
            disabled={approvePending || denyPending}
          >
            Deny
          </button>
        </form>
        <form action={approveAction}>
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />
          <input type="hidden" name="user_id" value={userId} />
          {state && <input type="hidden" name="state" value={state} />}
          {scope && <input type="hidden" name="scope" value={scope} />}
          <button
            type="submit"
            disabled={approvePending || denyPending}
            aria-busy={approvePending}
          >
            {approvePending ? 'Authorizing…' : 'Allow'}
          </button>
        </form>
      </div>
    </article>
  )
}
