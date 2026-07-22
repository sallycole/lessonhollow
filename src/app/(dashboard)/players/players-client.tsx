'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { createPlayer, updatePlayer, deletePlayer, type PlayerActionState } from './actions'
import { timezones, detectTimezone } from '@/lib/timezones'
import { trackEvent } from '@/components/analytics'
import { Copy, Check, User, Plus, Eye, EyeOff, KeyRound } from 'lucide-react'

export type PlayerWithDetails = {
  id: string
  username: string
  first_name: string
  last_name: string
  time_zone: string
  active_enrollment_count: number
}

const initialState: PlayerActionState = {}

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

// ---------------------------------------------------------------------------
// PlayerForm — shared by Add and Edit dialogs
// ---------------------------------------------------------------------------

function PlayerForm({
  player,
  onSuccess,
  onCancel,
}: {
  player?: PlayerWithDetails
  onSuccess: (password?: string, username?: string) => void
  onCancel: () => void
}) {
  const isEdit = !!player
  const action = isEdit ? updatePlayer.bind(null, player.id) : createPlayer
  const [state, formAction, pending] = useActionState(action, initialState)

  const [showPassword, setShowPassword] = useState(false)
  const [defaultTz] = useState(
    () => player?.time_zone ?? detectTimezone(new Date().getTimezoneOffset()),
  )

  useEffect(() => {
    if (state.success) {
      if (!isEdit) trackEvent('add_player', { source: 'dashboard' })
      onSuccess(state.password, state.username)
    }
  }, [state.success, onSuccess, state.password, state.username, isEdit])

  return (
    <form action={formAction}>
      <div className="form-grid-2">
        <label>
          First Name
          <input
            id="first_name"
            name="first_name"
            required
            defaultValue={player?.first_name}
            placeholder="Jane"
            aria-invalid={!!state.fieldErrors?.first_name || undefined}
          />
          {state.fieldErrors?.first_name && (
            <small className="field-error" role="alert">
              {state.fieldErrors.first_name[0]}
            </small>
          )}
        </label>
        <label>
          Last Name
          <input
            id="last_name"
            name="last_name"
            required
            defaultValue={player?.last_name}
            placeholder="Smith"
            aria-invalid={!!state.fieldErrors?.last_name || undefined}
          />
          {state.fieldErrors?.last_name && (
            <small className="field-error" role="alert">
              {state.fieldErrors.last_name[0]}
            </small>
          )}
        </label>
      </div>

      <label>
        Username
        <input
          id="username"
          name="username"
          required
          defaultValue={player?.username}
          placeholder="janesmith"
          aria-invalid={!!state.fieldErrors?.username || undefined}
        />
        {state.fieldErrors?.username && (
          <small className="field-error" role="alert">
            {state.fieldErrors.username[0]}
          </small>
        )}
      </label>

      <label>
        {isEdit ? 'New Password (leave blank to keep current)' : 'Password'}
        {!isEdit && <small>Must be at least 8 characters.</small>}
        <div className="password-row">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required={!isEdit}
            minLength={8}
            placeholder={isEdit ? '••••••••' : 'At least 8 characters'}
            aria-invalid={!!state.fieldErrors?.password || undefined}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {state.fieldErrors?.password && (
          <small className="field-error" role="alert">
            {state.fieldErrors.password[0]}
          </small>
        )}
      </label>

      <label>
        Time Zone
        <select id="time_zone" name="time_zone" defaultValue={defaultTz}>
          {timezones.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </label>

      {state.error && state.error !== 'Validation failed.' && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}

      <footer>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={pending} aria-busy={pending}>
          {pending
            ? isEdit
              ? 'Saving…'
              : 'Adding…'
            : isEdit
              ? 'Save Changes'
              : 'Add Player'}
        </button>
      </footer>
    </form>
  )
}

// ---------------------------------------------------------------------------
// PlayerCard
// ---------------------------------------------------------------------------

function PlayerCard({
  player,
  onEdit,
  onDelete,
}: {
  player: PlayerWithDetails
  onEdit: () => void
  onDelete: () => void
}) {
  const tzLabel =
    timezones.find((tz) => tz.value === player.time_zone)?.label ?? player.time_zone

  return (
    <article className="player-row">
      <header>
        <h2>
          {player.first_name} {player.last_name}
        </h2>
      </header>

      <p className="row-meta">
        Select{' '}
        <strong>
          {player.first_name} {player.last_name}&apos;s View
        </strong>{' '}
        from the dropdown in the upper right to masquerade as {player.first_name}{' '}
        {player.last_name} and configure this account.
      </p>

      <dl className="player-facts">
        <div>
          <dt>Username</dt>
          <dd>
            <code>{player.username}</code>
          </dd>
        </div>
        <div>
          <dt>Time Zone</dt>
          <dd>{tzLabel}</dd>
        </div>
        <div>
          <dt>Password</dt>
          <dd>
            <small>Use Edit to reset</small>
          </dd>
        </div>
        <div>
          <dt>Active Enrollments</dt>
          <dd>{player.active_enrollment_count}</dd>
        </div>
      </dl>

      <footer>
        <button type="button" className="outline secondary" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="outline contrast" onClick={onDelete}>
          Delete
        </button>
      </footer>
    </article>
  )
}

// ---------------------------------------------------------------------------
// PasswordRevealDialog
// ---------------------------------------------------------------------------

function PasswordRevealDialog({
  username,
  password,
  open,
  onOpenChange,
}: {
  username: string
  password: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null)
  const ref = useNativeDialog(open, () => onOpenChange(false))

  async function copyToClipboard(value: string, field: 'username' | 'password') {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <dialog ref={ref}>
      <article>
        <header>
          <h3>
            <KeyRound size={18} style={{ verticalAlign: 'text-bottom', marginRight: '0.5rem' }} />
            Player Credentials
          </h3>
          <p>
            Save this username and password. You won&apos;t be able to see the password again.
          </p>
        </header>

        <div className="credential-row">
          <div>
            <small>Username</small>
            <code>{username}</code>
          </div>
          <button
            type="button"
            className="copy-btn"
            onClick={() => copyToClipboard(username, 'username')}
            aria-label={copiedField === 'username' ? 'Username copied' : 'Copy username'}
          >
            {copiedField === 'username' ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <div className="credential-row">
          <div>
            <small>Password</small>
            <code>{password}</code>
          </div>
          <button
            type="button"
            className="copy-btn"
            onClick={() => copyToClipboard(password, 'password')}
            aria-label={copiedField === 'password' ? 'Password copied' : 'Copy password'}
          >
            {copiedField === 'password' ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>

        <footer>
          <button type="button" onClick={() => onOpenChange(false)}>
            Done
          </button>
        </footer>
      </article>
    </dialog>
  )
}

// ---------------------------------------------------------------------------
// DeleteConfirmation
// ---------------------------------------------------------------------------

function DeleteConfirmation({
  player,
  open,
  onOpenChange,
}: {
  player: PlayerWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!player) return null
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const ref = useNativeDialog(open, () => onOpenChange(false))

  async function handleDelete() {
    setDeleting(true)
    setError('')
    const result = await deletePlayer(player!.id)
    if (result.error) {
      setError(result.error)
      setDeleting(false)
    } else {
      onOpenChange(false)
    }
  }

  return (
    <dialog ref={ref}>
      <article>
        <header>
          <h3>
            Delete {player.first_name} {player.last_name}?
          </h3>
          <p>
            This will permanently remove this Player account and all associated data
            including enrollments, task history, and time records. This action cannot
            be undone.
          </p>
        </header>
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" className="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="contrast"
            onClick={handleDelete}
            disabled={deleting}
            aria-busy={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete Player'}
          </button>
        </footer>
      </article>
    </dialog>
  )
}

// ---------------------------------------------------------------------------
// PlayersClient
// ---------------------------------------------------------------------------

export function PlayersClient({
  players,
  isAtPlayerLimit,
}: {
  players: PlayerWithDetails[]
  isAtPlayerLimit: boolean
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [limitOpen, setLimitOpen] = useState(false)
  const [addKey, setAddKey] = useState(0)
  const [editPlayer, setEditPlayer] = useState<PlayerWithDetails | null>(null)
  const [editKey, setEditKey] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<PlayerWithDetails | null>(null)
  const [revealCredentials, setRevealCredentials] = useState<{
    username: string
    password: string
  } | null>(null)

  const addDialogRef = useNativeDialog(addOpen, () => setAddOpen(false))
  const editDialogRef = useNativeDialog(!!editPlayer, () => setEditPlayer(null))
  const limitDialogRef = useNativeDialog(limitOpen, () => setLimitOpen(false))

  function handleAddOpen() {
    if (isAtPlayerLimit) {
      setLimitOpen(true)
      return
    }
    setAddKey((k) => k + 1)
    setAddOpen(true)
  }

  function handleEditOpen(player: PlayerWithDetails) {
    setEditKey((k) => k + 1)
    setEditPlayer(player)
  }

  return (
    <>
      <div className="players-header">
        <hgroup>
          <h1>Manage Players</h1>
          <p>Add or edit Player accounts.</p>
        </hgroup>
        <button type="button" className="outline" onClick={handleAddOpen}>
          <Plus size={14} /> Add Player
        </button>
      </div>

      <div className="players-shell">
        {players.length === 0 ? (
          <article className="players-empty">
            <User size={40} aria-hidden="true" />
            <h2>No Players yet</h2>
            <p>Add your first Player to get started with Lesson Hollow.</p>
          </article>
        ) : (
          players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onEdit={() => handleEditOpen(player)}
              onDelete={() => setDeleteTarget(player)}
            />
          ))
        )}
      </div>

      <dialog ref={addDialogRef}>
        <article>
          <header>
            <h3>Add Player</h3>
            <p>
              Create a new Player account. They can log in with their username and
              password.
            </p>
          </header>
          <PlayerForm
            key={addKey}
            onSuccess={(pw, un) => {
              setAddOpen(false)
              if (pw && un) setRevealCredentials({ username: un, password: pw })
            }}
            onCancel={() => setAddOpen(false)}
          />
        </article>
      </dialog>

      <dialog ref={editDialogRef}>
        <article>
          <header>
            <h3>Edit Player</h3>
            <p>Update player details. Leave password blank to keep it unchanged.</p>
          </header>
          {editPlayer && (
            <PlayerForm
              key={editKey}
              player={editPlayer}
              onSuccess={(pw, un) => {
                setEditPlayer(null)
                if (pw && un) setRevealCredentials({ username: un, password: pw })
              }}
              onCancel={() => setEditPlayer(null)}
            />
          )}
        </article>
      </dialog>

      <dialog ref={limitDialogRef}>
        <article>
          <header>
            <h3>Player Limit Reached</h3>
            <p>
              You&apos;ve reached your plan&apos;s player limit. Upgrade to add more
              players.
            </p>
          </header>
          <footer>
            <button type="button" className="secondary" onClick={() => setLimitOpen(false)}>
              Cancel
            </button>
            <a href="/pricing" role="button">
              Upgrade Plan
            </a>
          </footer>
        </article>
      </dialog>

      {deleteTarget && (
        <DeleteConfirmation
          player={deleteTarget}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
        />
      )}

      <PasswordRevealDialog
        username={revealCredentials?.username ?? ''}
        password={revealCredentials?.password ?? ''}
        open={!!revealCredentials}
        onOpenChange={(open) => {
          if (!open) setRevealCredentials(null)
        }}
      />
    </>
  )
}
