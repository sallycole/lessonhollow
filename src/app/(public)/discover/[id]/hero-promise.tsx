'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CurriculumLanding } from '@/content/curricula/types'
import type { Player } from './curriculum-landing'
import {
  adoptForGuideFirstTimeAction,
  adoptForCurrentPlayerAction,
  getLandingContextAction,
  type LandingContext,
} from './actions'

type Task = { action_type: string }

type Curriculum = {
  id: string
  public_title: string | null
  name: string
  public_description: string | null
  publisher_name: string | null
  grade_level: string | null
}

type HeroPromiseProps = {
  curriculum: Curriculum
  tasks: Task[]
  landing: CurriculumLanding | null
  isAuthenticated?: boolean
  players?: Player[]
}

function buildActionSummary(tasks: Task[]): string {
  const counts = new Map<string, number>()
  for (const t of tasks) {
    const type = t.action_type || 'Do'
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return ''
  if (sorted.length === 1) return sorted[0][0]
  if (sorted.length === 2) return `${sorted[0][0]} + ${sorted[1][0]}`
  return `${sorted[0][0]}, ${sorted[1][0]} + more`
}

export function HeroPromise({
  curriculum,
  tasks,
  landing,
  isAuthenticated,
  players,
}: HeroPromiseProps) {
  const headline = landing?.hero.headline ?? curriculum.public_title ?? curriculum.name
  const subhead = landing?.hero.subhead ?? curriculum.public_description
  const ctaLabel = landing?.ctaLabel ?? 'Make This My First Curriculum'
  const ctaSubtext = landing?.ctaSubtext ?? 'Starts with this curriculum preloaded'
  const backgroundImage = landing?.hero.backgroundImage

  const taskCount = tasks.length
  const gradeLevel = curriculum.grade_level
  const actionSummary = buildActionSummary(tasks)

  const stats = landing?.stats ?? [
    ...(taskCount > 0 ? [{ label: 'tasks', value: taskCount.toLocaleString() }] : []),
    ...(gradeLevel ? [{ label: 'level', value: gradeLevel }] : []),
    ...(actionSummary ? [{ label: 'format', value: actionSummary }] : []),
  ]

  return (
    <section
      className={backgroundImage ? 'discover-hero has-bg-image' : 'discover-hero'}
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
    >
      <hgroup>
        <h1>{headline}</h1>
        {subhead && <p>{subhead}</p>}
      </hgroup>

      <div className="adopt-cta">
        <AdoptCta
          curriculumId={curriculum.id}
          ctaLabel={ctaLabel}
          ctaSubtext={ctaSubtext}
          isAuthenticated={isAuthenticated}
          players={players}
        />
      </div>

      {stats.length > 0 && (
        <p className="hero-stats">
          {stats.map((stat, i) => (
            <span key={i}>
              <strong>{stat.value}</strong>
              {stat.label}
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

export function AdoptCta({
  curriculumId,
  ctaLabel,
  ctaSubtext,
  isAuthenticated,
  players,
}: {
  curriculumId: string
  ctaLabel: string
  ctaSubtext: string
  isAuthenticated?: boolean
  players?: Player[]
}) {
  // Unauthenticated and no-players cases are known from server props and don't
  // need a context fetch — render them immediately.
  if (!isAuthenticated) {
    return (
      <>
        <Link href={`/signup?curriculum=${curriculumId}`} role="button">
          {ctaLabel}
        </Link>
        {ctaSubtext && <p>{ctaSubtext}</p>}
      </>
    )
  }

  return <AuthenticatedAdoptCta curriculumId={curriculumId} />
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

function AuthenticatedAdoptCta({ curriculumId }: { curriculumId: string }) {
  const router = useRouter()
  const [context, setContext] = useState<LandingContext | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  async function loadContext() {
    setContextError(null)
    const result = await getLandingContextAction(curriculumId)
    if (result.error) {
      setContextError(result.error)
      return null
    }
    setContext(result.context!)
    return result.context
  }

  useEffect(() => {
    void loadContext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curriculumId])

  useEffect(() => {
    if (!showDialog) setActionError(null)
  }, [showDialog])

  const dialogRef = useNativeDialog(showDialog, () => setShowDialog(false))

  if (contextError) {
    return (
      <p role="alert" style={{ color: 'var(--pico-del-color)' }}>
        {contextError}
      </p>
    )
  }

  if (!context) {
    return (
      <button disabled aria-busy="true">
        Loading…
      </button>
    )
  }

  if (context.mode === 'no-players') {
    return (
      <>
        <Link href="/players" role="button">
          Add a Player to Get Started
        </Link>
        <p>Create a Player account first, then come back to adopt this curriculum.</p>
      </>
    )
  }

  if (context.mode === 'single-player') {
    return <SinglePlayerPanel curriculumId={curriculumId} context={context} />
  }

  if (context.mode === 'first-time-picker') {
    function openPicker() {
      const ctx = context!
      if (ctx.mode !== 'first-time-picker') return
      setSelected(new Set(ctx.players.map((p) => p.id)))
      setShowDialog(true)
    }

    function togglePlayer(playerId: string) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(playerId)) next.delete(playerId)
        else next.add(playerId)
        return next
      })
    }

    function handleAdopt() {
      const ids = [...selected]
      if (ids.length === 0) return
      setActionError(null)
      startTransition(async () => {
        const result = await adoptForGuideFirstTimeAction(curriculumId, ids)
        if (result.error) {
          setActionError(result.error)
          void loadContext()
          return
        }
        if (result.results && result.results.length > 0) {
          router.push(`/curriculums/${result.results[0].curriculumId}/enroll`)
        }
      })
    }

    return (
      <>
        <button type="button" onClick={openPicker} disabled={isPending}>
          {isPending ? 'Copying curriculum…' : 'Add to My Curriculums'}
        </button>
        <p>Copy this curriculum to your collection, then enroll.</p>
        {actionError && (
          <p role="alert" style={{ color: 'var(--pico-del-color)' }}>
            {actionError}
          </p>
        )}

        <dialog ref={dialogRef}>
          <article>
            <header>
              <h3>Who gets this curriculum?</h3>
              <p>Each selected Player will receive their own copy to work through.</p>
            </header>
            <div className="player-picker">
              {context.players.map((player) => {
                const fullName = `${player.first_name} ${player.last_name}`.trim()
                const label = player.isGuidePlayer ? `You (${fullName})` : fullName
                return (
                  <label key={player.id}>
                    <input
                      type="checkbox"
                      checked={selected.has(player.id)}
                      onChange={() => togglePlayer(player.id)}
                    />
                    <span>{label}</span>
                  </label>
                )
              })}
            </div>
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdopt}
                disabled={selected.size === 0 || isPending}
              >
                {selected.size === 0
                  ? 'Select a Player'
                  : selected.size === 1
                    ? 'Add for 1 Player'
                    : `Add for ${selected.size} Players`}
              </button>
            </footer>
          </article>
        </dialog>
      </>
    )
  }

  if (context.mode === 'guide-switcher') {
    async function handleSwitchTo(playerId: string) {
      setActionError(null)
      try {
        const res = await fetch(`/api/auth/masquerade?player=${playerId}`, {
          method: 'POST',
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setActionError(body.error || 'Failed to switch.')
          return
        }
        router.refresh()
        await loadContext()
        setShowDialog(false)
      } catch {
        setActionError('Failed to switch.')
      }
    }

    return (
      <>
        <button
          type="button"
          className="outline"
          onClick={() => setShowDialog(true)}
        >
          Already Added
        </button>
        <p>
          You&apos;ve added this for some of your Players. Open to manage or add for
          others.
        </p>

        <dialog ref={dialogRef}>
          <article>
            <header>
              <h3>You&apos;ve already added this curriculum</h3>
              <p>To add it for someone else, switch to that Player and adopt from there.</p>
            </header>
            <div className="player-switcher">
              {context.players.map((p) => {
                const fullName = `${p.first_name} ${p.last_name}`.trim()
                const label = p.isGuidePlayer ? `You (${fullName})` : fullName
                return (
                  <div key={p.id} className="player-row">
                    <span>
                      {p.hasCopy ? '✓ ' : ''}
                      {label}
                    </span>
                    {p.hasCopy && p.copyId ? (
                      <Link href={`/curriculums/${p.copyId}`}>View</Link>
                    ) : (
                      <button
                        type="button"
                        className="outline"
                        onClick={() => handleSwitchTo(p.id)}
                      >
                        Switch to {p.isGuidePlayer ? 'your Player view' : p.first_name}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {actionError && (
              <p role="alert" style={{ color: 'var(--pico-del-color)' }}>
                {actionError}
              </p>
            )}
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowDialog(false)}
              >
                Close
              </button>
            </footer>
          </article>
        </dialog>
      </>
    )
  }

  return null
}

function SinglePlayerPanel({
  curriculumId,
  context,
}: {
  curriculumId: string
  context: Extract<LandingContext, { mode: 'single-player' }>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showFreshCopyInput, setShowFreshCopyInput] = useState(false)
  const [freshCopyName, setFreshCopyName] = useState(() => {
    if (context.copy.state === 'modified') {
      return `V2: ${context.copy.copyName}`
    }
    return ''
  })

  function handleAddFresh() {
    setError(null)
    startTransition(async () => {
      const result = await adoptForCurrentPlayerAction(curriculumId)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.curriculumId) {
        router.push(`/curriculums/${result.curriculumId}/enroll`)
      }
    })
  }

  function handleCreateFreshCopy() {
    const name = freshCopyName.trim()
    if (!name) return
    setError(null)
    startTransition(async () => {
      const result = await adoptForCurrentPlayerAction(curriculumId, { copyName: name })
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.curriculumId) {
        router.push(`/curriculums/${result.curriculumId}/enroll`)
      }
    })
  }

  if (context.copy.state === 'none') {
    return (
      <>
        <button type="button" onClick={handleAddFresh} disabled={isPending}>
          {isPending ? 'Copying curriculum…' : 'Add to My Account'}
        </button>
        <p>
          Copy this curriculum to {context.player.first_name}&apos;s account, then
          enroll.
        </p>
        {error && (
          <p role="alert" style={{ color: 'var(--pico-del-color)' }}>
            {error}
          </p>
        )}
      </>
    )
  }

  if (context.copy.state === 'unmodified') {
    return (
      <>
        <Link href={`/curriculums/${context.copy.copyId}`} role="button" className="outline">
          Open It
        </Link>
        <p>You already have this curriculum.</p>
      </>
    )
  }

  // modified
  return (
    <>
      {!showFreshCopyInput ? (
        <>
          <p>
            <Link href={`/curriculums/${context.copy.copyId}`} role="button" className="outline">
              Open Your Copy
            </Link>
            {' '}
            <button
              type="button"
              className="outline"
              onClick={() => setShowFreshCopyInput(true)}
            >
              Add a Fresh Copy
            </button>
          </p>
          <p>
            You&apos;ve made changes to your copy of this curriculum. Open it, or add
            an additional fresh copy alongside.
          </p>
        </>
      ) : (
        <div style={{ maxWidth: '24rem', margin: '0 auto' }}>
          <p>
            This will create a second copy alongside the one you&apos;ve already
            modified. Pick a name so you can tell them apart.
          </p>
          <input
            type="text"
            value={freshCopyName}
            onChange={(e) => setFreshCopyName(e.target.value)}
            placeholder="Curriculum name"
            maxLength={200}
          />
          <p>
            <button
              type="button"
              className="secondary"
              onClick={() => setShowFreshCopyInput(false)}
              disabled={isPending}
            >
              Cancel
            </button>
            {' '}
            <button
              type="button"
              onClick={handleCreateFreshCopy}
              disabled={isPending || !freshCopyName.trim()}
            >
              {isPending ? 'Creating…' : 'Create Fresh Copy'}
            </button>
          </p>
        </div>
      )}
      {error && (
        <p role="alert" style={{ color: 'var(--pico-del-color)' }}>
          {error}
        </p>
      )}
    </>
  )
}
