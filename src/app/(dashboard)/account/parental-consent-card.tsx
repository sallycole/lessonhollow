'use client'

import { useState, useEffect, useRef } from 'react'
import { revokeConsent } from './actions'

interface ParentalConsentCardProps {
  consentDate: string
}

function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const handler = () => onClose()
    node.addEventListener('close', handler)
    return () => node.removeEventListener('close', handler)
  }, [onClose])
  return ref
}

export function ParentalConsentCard({ consentDate }: ParentalConsentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useNativeDialog(dialogOpen, () => setDialogOpen(false))

  async function handleRevoke() {
    setLoading(true)
    setError(null)
    const result = await revokeConsent(confirmation)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, page revalidates and re-renders with consentDate = null
  }

  return (
    <article className="account-card">
      <header>
        <hgroup>
          <h2>Parental Consent</h2>
          <p>Authorization for children&apos;s educational data collection.</p>
        </hgroup>
      </header>

      <p>
        <small>
          <strong>Consent given:</strong>{' '}
          {new Date(consentDate).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </small>
      </p>

      {!expanded ? (
        <button
          type="button"
          className="outline contrast"
          onClick={() => setExpanded(true)}
          style={{ margin: 0, padding: '0.4rem 1rem', fontSize: '0.875rem', width: 'auto' }}
        >
          Revoke Consent
        </button>
      ) : (
        <div className="danger-zone">
          <strong>Warning: This will permanently delete all Player accounts and their data</strong>
          <ul>
            <li>All Player sub-accounts</li>
            <li>Task history and completion records</li>
            <li>Enrollment data and time records</li>
            <li>Reward files</li>
            <li>Player authentication accounts</li>
          </ul>
          <p>
            Your Guide account will remain active. You can create new Player accounts later
            (which requires re-consenting).
          </p>
          <div className="danger-actions">
            <button type="button" className="contrast" onClick={() => setDialogOpen(true)}>
              Continue
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setExpanded(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <dialog ref={dialogRef}>
        <article>
          <header>
            <h3>Revoke Parental Consent</h3>
            <p>This action is permanent and cannot be undone. All Player data will be deleted.</p>
          </header>
          <p>
            Type <code><strong>REVOKE</strong></code> to confirm:
          </p>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="REVOKE"
            disabled={loading}
          />
          {error && (
            <p style={{ color: 'var(--pico-del-color)', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
              {error}
            </p>
          )}
          <footer>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setDialogOpen(false)
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
              onClick={handleRevoke}
              disabled={confirmation !== 'REVOKE' || loading}
              aria-busy={loading}
            >
              {loading ? 'Revoking…' : 'Revoke Consent'}
            </button>
          </footer>
        </article>
      </dialog>
    </article>
  )
}
