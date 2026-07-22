'use client'

import { useState } from 'react'
import { deleteAccount } from './actions'

interface DeleteAccountCardProps {
  playerCount: number
}

export function DeleteAccountCard({ playerCount }: DeleteAccountCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const result = await deleteAccount(confirmation)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <article className="account-card">
      <header>
        <hgroup>
          <h2>Delete Account</h2>
          <p>Permanently remove your account and all associated data.</p>
        </hgroup>
        {!expanded && (
          <button
            type="button"
            className="outline contrast"
            onClick={() => setExpanded(true)}
          >
            Delete
          </button>
        )}
      </header>

      {expanded && (
        <div className="danger-zone">
          <strong>Danger Zone</strong>
          <p>
            This will also delete {playerCount} Player account
            {playerCount !== 1 ? 's' : ''} and all associated data. This cannot be undone.
          </p>
          <p>
            Type <code><strong>DELETE</strong></code> to confirm:
          </p>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="DELETE"
            disabled={loading}
          />
          {error && (
            <p style={{ color: 'var(--pico-del-color)', fontSize: '0.875rem', margin: 0 }}>
              {error}
            </p>
          )}
          <div className="danger-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setExpanded(false)
                setConfirmation('')
                setError(null)
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="contrast"
              onClick={handleDelete}
              disabled={confirmation !== 'DELETE' || loading}
              aria-busy={loading}
            >
              {loading ? 'Deleting…' : 'Delete My Account'}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
