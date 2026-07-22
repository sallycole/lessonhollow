'use client'

import { useState, useTransition } from 'react'
import { updateProfile } from './actions'
import { toast } from 'sonner'
import { timezones } from '@/lib/timezones'

interface ProfileCardProps {
  email: string
  firstName: string
  lastName: string
  timezone: string
}

export function ProfileCard({ email, firstName, lastName, timezone }: ProfileCardProps) {
  const [editing, setEditing] = useState(false)
  const [first, setFirst] = useState(firstName)
  const [last, setLast] = useState(lastName)
  const [tz, setTz] = useState(timezone)
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    setFirst(firstName)
    setLast(lastName)
    setTz(timezone)
    setEditing(false)
  }

  function handleSave() {
    if (!first.trim() || !last.trim()) {
      toast.error('Name fields are required.')
      return
    }
    startTransition(async () => {
      const result = await updateProfile({
        first_name: first,
        last_name: last,
        timezone: tz,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Profile updated.')
      setEditing(false)
    })
  }

  return (
    <article className="account-card">
      <header>
        <hgroup>
          <h2>Profile</h2>
        </hgroup>
        {!editing && (
          <button type="button" className="outline" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </header>

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
        >
          <div className="form-grid-2">
            <label>
              First name
              <input
                id="first-name"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                disabled={isPending}
                required
              />
            </label>
            <label>
              Last name
              <input
                id="last-name"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                disabled={isPending}
                required
              />
            </label>
          </div>
          <label>
            Email
            <p>
              <small>{email}</small>
            </p>
          </label>
          <label>
            Time zone
            <select
              id="timezone"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              disabled={isPending}
            >
              {timezones.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
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
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </footer>
        </form>
      ) : (
        <div className="field-readonly">
          <div>
            <small>First Name</small>
            <p>{firstName || 'Not set'}</p>
          </div>
          <div>
            <small>Last Name</small>
            <p>{lastName || 'Not set'}</p>
          </div>
          <div>
            <small>Email</small>
            <p>{email}</p>
          </div>
          <div>
            <small>Time Zone</small>
            <p>{timezones.find((t) => t.value === timezone)?.label || timezone || 'Not set'}</p>
          </div>
        </div>
      )}
    </article>
  )
}
