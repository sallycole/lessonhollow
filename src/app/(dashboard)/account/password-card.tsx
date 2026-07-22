'use client'

import { useState, useTransition } from 'react'
import { changePassword } from './actions'
import { toast } from 'sonner'

export function PasswordCard() {
  const [editing, setEditing] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setEditing(false)
  }

  function handleSubmit() {
    if (newPw.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match.')
      return
    }
    if (newPw === currentPw) {
      toast.error('New password must differ from current password.')
      return
    }
    startTransition(async () => {
      const result = await changePassword({
        currentPassword: currentPw,
        newPassword: newPw,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Password updated.')
      handleCancel()
    })
  }

  return (
    <article className="account-card">
      <header>
        <hgroup>
          <h2>Password</h2>
          <p>Change your account password.</p>
        </hgroup>
        {!editing && (
          <button type="button" className="outline" onClick={() => setEditing(true)}>
            Change
          </button>
        )}
      </header>

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
        >
          <label>
            Current password
            <input
              id="current-password"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              disabled={isPending}
              autoComplete="current-password"
            />
          </label>
          <label>
            New password
            <input
              id="new-password"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              disabled={isPending}
              minLength={8}
              autoComplete="new-password"
            />
            <small>Minimum 8 characters</small>
          </label>
          <label>
            Confirm new password
            <input
              id="confirm-password"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              disabled={isPending}
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <footer>
            <button
              type="button"
              className="secondary"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </button>
            <button type="submit" disabled={isPending} aria-busy={isPending}>
              {isPending ? 'Updating…' : 'Update password'}
            </button>
          </footer>
        </form>
      )}
    </article>
  )
}
