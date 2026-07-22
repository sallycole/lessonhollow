'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { generateActivityMarkdown, generatePeriodMarkdown } from '@/lib/export-log'
import {
  BookOpen,
  Check,
  Clipboard,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import {
  addSpontaneousEntry,
  updateFeedItemNotes,
  updateFeedItemTime,
  updateFeedItemTimestamp,
  deleteLogEntry,
} from './actions'
import type { DayData, WeekData, MonthData, YearData } from './page'

export type FeedItem = {
  id: string
  type: 'task' | 'spontaneous'
  title: string
  description: string | null
  actionType: string
  resourceUrl: string | null
  curriculumName: string | null
  status: 'completed' | 'skipped'
  timeSpentMinutes: number
  timestamp: string
  notes: string | null
}

const TAB_VALUES = ['daily', 'weekly', 'monthly', 'yearly'] as const
type TabValue = (typeof TAB_VALUES)[number]

const TAB_LABELS: Record<TabValue, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
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

function formatItemTime(timestamp: string): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  const mm = String(minutes).padStart(2, '0')
  return `${h}:${mm} ${ampm}`
}

function formatDuration(minutes: number): string {
  if (minutes === 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatItemDate(timestamp: string): {
  dayOfWeek: string
  monthDay: string
} {
  if (!timestamp) return { dayOfWeek: '', monthDay: '' }
  const d = new Date(timestamp)
  const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' })
  const monthDay = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return { dayOfWeek, monthDay }
}

// ---------------------------------------------------------------------------
// Copy button with idle / copying / success / error states
// ---------------------------------------------------------------------------

type CopyState = 'idle' | 'copying' | 'success' | 'error'

function CopyButton({ getText }: { getText: () => string }) {
  const [state, setState] = useState<CopyState>('idle')

  async function handleCopy() {
    setState('copying')
    try {
      await navigator.clipboard.writeText(getText())
      setState('success')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const icon = {
    idle: <Clipboard size={14} />,
    copying: <Loader2 size={14} className="spin" />,
    success: <Check size={14} />,
    error: <X size={14} />,
  }[state]

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        handleCopy()
      }}
      disabled={state === 'copying'}
      className={`icon-button copy-button copy-${state}`}
      aria-label="Copy to clipboard"
    >
      {icon}
    </button>
  )
}

// ---------------------------------------------------------------------------
// InlineTimeEdit
// ---------------------------------------------------------------------------

function InlineTimeEdit({
  itemId,
  itemType,
  initialMinutes,
  canEdit,
}: {
  itemId: string
  itemType: 'task' | 'spontaneous'
  initialMinutes: number
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [hours, setHours] = useState('')
  const [mins, setMins] = useState('')
  const [isPending, startTransition] = useTransition()

  function filterDigits(value: string): string {
    return value.replace(/\D/g, '')
  }

  function startEditing() {
    const h = Math.floor(initialMinutes / 60)
    const m = Math.round(initialMinutes % 60)
    setHours(h > 0 ? String(h) : '')
    setMins(m > 0 ? String(m) : '')
    setEditing(true)
  }

  function save() {
    const h = parseInt(hours, 10) || 0
    const m = parseInt(mins, 10) || 0
    const total = h * 60 + m
    if (total === initialMinutes) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      const result = await updateFeedItemTime(itemId, itemType, total)
      if (result.error) {
        toast.error(result.error)
      }
      setEditing(false)
      router.refresh()
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <span className="inline-time-edit">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={hours}
          onChange={(e) => setHours(filterDigits(e.target.value))}
          onKeyDown={handleKeyDown}
          placeholder="0"
          autoFocus
          disabled={isPending}
          aria-label="Hours"
        />
        <span>h</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={mins}
          onChange={(e) => setMins(filterDigits(e.target.value))}
          onBlur={save}
          onKeyDown={handleKeyDown}
          placeholder="0"
          disabled={isPending}
          aria-label="Minutes"
        />
        <span>m</span>
      </span>
    )
  }

  if (isPending) {
    return <span className="duration-label">&hellip;</span>
  }

  if (!canEdit) {
    return (
      <span className="duration-label">
        {initialMinutes > 0 ? formatDuration(initialMinutes) : '—'}
      </span>
    )
  }

  return (
    <button
      type="button"
      className="duration-label as-button"
      onClick={startEditing}
    >
      {initialMinutes > 0 ? formatDuration(initialMinutes) : '—'}
    </button>
  )
}

// ---------------------------------------------------------------------------
// InlineNotesEdit
// ---------------------------------------------------------------------------

function InlineNotesEdit({
  itemId,
  itemType,
  initialNotes,
}: {
  itemId: string
  itemType: 'task' | 'spontaneous'
  initialNotes: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialNotes ?? '')
  const [isPending, startTransition] = useTransition()

  function startEditing() {
    setValue(initialNotes ?? '')
    setEditing(true)
  }

  function handleBlur() {
    const trimmed = value.trim()
    const original = initialNotes?.trim() ?? ''
    if (trimmed === original) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      const result = await updateFeedItemNotes(
        itemId,
        itemType,
        trimmed || null
      )
      if (result.error) {
        toast.error(result.error)
      }
      setEditing(false)
      router.refresh()
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setValue(initialNotes ?? '')
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <textarea
        className="notes-edit"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        maxLength={2000}
        rows={2}
        autoFocus
        disabled={isPending}
      />
    )
  }

  if (initialNotes) {
    return (
      <button
        type="button"
        className="notes-display as-button"
        onClick={startEditing}
      >
        &ldquo;{initialNotes}&rdquo;
      </button>
    )
  }

  return (
    <button
      type="button"
      className="notes-placeholder"
      onClick={startEditing}
    >
      Add notes…
    </button>
  )
}

// ---------------------------------------------------------------------------
// InlineDateTimeEdit
// ---------------------------------------------------------------------------

function InlineDateTimeEdit({
  itemId,
  itemType,
  timestamp,
}: {
  itemId: string
  itemType: 'task' | 'spontaneous'
  timestamp: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  const d = new Date(timestamp)
  const localISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const [value, setValue] = useState(localISO)

  function handleSave() {
    if (value === localISO) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      const result = await updateFeedItemTimestamp(itemId, itemType, value)
      if (result.error) {
        toast.error(result.error)
      }
      setEditing(false)
      router.refresh()
    })
  }

  if (editing) {
    return (
      <input
        type="datetime-local"
        className="datetime-edit"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') { setValue(localISO); setEditing(false) }
        }}
        autoFocus
        disabled={isPending}
      />
    )
  }

  const { dayOfWeek, monthDay } = formatItemDate(timestamp)
  const timeStr = formatItemTime(timestamp)

  return (
    <button
      type="button"
      className="feed-item-date as-button"
      onClick={() => { setValue(localISO); setEditing(true) }}
    >
      <strong>{dayOfWeek}</strong>
      <span>{monthDay}</span>
      <span>{timeStr}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// FeedItemCard
// ---------------------------------------------------------------------------

function FeedItemCard({
  item,
  editMode,
  playerName,
}: {
  item: FeedItem
  editMode: boolean
  playerName: string
}) {
  const router = useRouter()
  const { dayOfWeek, monthDay } = formatItemDate(item.timestamp)
  const timeStr = formatItemTime(item.timestamp)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, startDeleteTransition] = useTransition()

  const deleteDialogRef = useNativeDialog(confirmDelete, () => setConfirmDelete(false))

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteLogEntry(item.id, item.type)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Entry deleted.')
        router.refresh()
      }
      setConfirmDelete(false)
    })
  }

  return (
    <article className="feed-item">
      <div className="feed-item-grid">
        {/* Left column — date/time (desktop only) */}
        <div className="feed-item-date-col">
          {editMode ? (
            <InlineDateTimeEdit
              itemId={item.id}
              itemType={item.type}
              timestamp={item.timestamp}
            />
          ) : (
            <div className="feed-item-date">
              <strong>{dayOfWeek}</strong>
              <span>{monthDay}</span>
              <span>{timeStr}</span>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="feed-item-content">
          {/* Mobile: date/time + duration/actions row */}
          <div className="feed-item-mobile-row">
            <div className="feed-item-mobile-date">
              {editMode ? (
                <InlineDateTimeEdit
                  itemId={item.id}
                  itemType={item.type}
                  timestamp={item.timestamp}
                />
              ) : (
                <>
                  <strong>{dayOfWeek} {monthDay}</strong>
                  <span>{timeStr}</span>
                </>
              )}
            </div>
            <div className="feed-item-mobile-actions">
              {editMode ? (
                <InlineTimeEdit
                  itemId={item.id}
                  itemType={item.type}
                  initialMinutes={item.timeSpentMinutes}
                  canEdit={item.status !== 'skipped'}
                />
              ) : (
                <span className="duration-label">{formatDuration(item.timeSpentMinutes)}</span>
              )}
              {editMode ? (
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash2 size={14} />
                </button>
              ) : (
                <CopyButton
                  getText={() => generateActivityMarkdown(item, playerName)}
                />
              )}
            </div>
          </div>

          <h4 className="curriculum-name">
            {item.type === 'spontaneous' ? <em>Spontaneous</em> : item.curriculumName}
          </h4>

          <div className="task-title-row">
            <span className="action-badge">{item.actionType}</span>
            <strong className="task-title">{item.title}</strong>
            {item.resourceUrl && (
              <a
                href={item.resourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open resource"
                className="task-resource"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          {item.description && (
            <p className="task-description">{item.description}</p>
          )}

          {editMode ? (
            <InlineNotesEdit
              itemId={item.id}
              itemType={item.type}
              initialNotes={item.notes}
            />
          ) : item.notes ? (
            <p className="feed-item-notes">&ldquo;{item.notes}&rdquo;</p>
          ) : null}
        </div>

        {/* Right column — duration + actions (desktop only) */}
        <div className="feed-item-actions-col">
          <div className="feed-item-duration">
            {editMode ? (
              <InlineTimeEdit
                itemId={item.id}
                itemType={item.type}
                initialMinutes={item.timeSpentMinutes}
                canEdit={item.status !== 'skipped'}
              />
            ) : (
              <span className="duration-label">{formatDuration(item.timeSpentMinutes)}</span>
            )}
          </div>
          {editMode ? (
            <button
              type="button"
              className="icon-button danger"
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete ${item.title}`}
            >
              <Trash2 size={14} />
            </button>
          ) : (
            <CopyButton
              getText={() => generateActivityMarkdown(item, playerName)}
            />
          )}
        </div>
      </div>

      <dialog ref={deleteDialogRef}>
        <article>
          <header>
            <h3>Delete this entry?</h3>
            <p>This will permanently remove &ldquo;{item.title}&rdquo; from your log.</p>
          </header>
          <footer>
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="contrast"
              onClick={handleDelete}
              disabled={deleting}
              aria-busy={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </footer>
        </article>
      </dialog>
    </article>
  )
}

// ---------------------------------------------------------------------------
// SpontaneousEntryDialog
// ---------------------------------------------------------------------------

const ACTION_TYPES = ['Read', 'Watch', 'Listen', 'Do'] as const

function SpontaneousEntryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [actionType, setActionType] = useState<string>('Do')
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [isPending, startTransition] = useTransition()

  const dialogRef = useNativeDialog(open, () => onOpenChange(false))

  function resetForm() {
    setTitle('')
    setActionType('Do')
    setDescription('')
    setHours('')
    setMinutes('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const h = parseInt(hours, 10) || 0
    const m = parseInt(minutes, 10) || 0
    const totalMinutes = h * 60 + m

    startTransition(async () => {
      const result = await addSpontaneousEntry({
        title: trimmedTitle,
        description: description.trim() || undefined,
        action_type: actionType as 'Read' | 'Watch' | 'Listen' | 'Do',
        time_spent_minutes: totalMinutes > 0 ? totalMinutes : undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Activity logged')
        resetForm()
        onOpenChange(false)
        router.refresh()
      }
    })
  }

  return (
    <dialog ref={dialogRef}>
      <article>
        <form onSubmit={handleSubmit}>
          <header>
            <h3>Log Activity</h3>
            <p>Record a spontaneous learning activity.</p>
          </header>

          <label htmlFor="spontaneous-title">
            What did you work on?
            <input
              id="spontaneous-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Read chapter 3 of..."
              required
            />
          </label>

          <label htmlFor="spontaneous-action">
            Action Type
            <select
              id="spontaneous-action"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
            >
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label htmlFor="spontaneous-description">
            Description <span>(optional)</span>
            <textarea
              id="spontaneous-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Add any details..."
            />
          </label>

          <fieldset>
            <legend>Time Spent <span>(optional)</span></legend>
            <div className="time-spent-row">
              <input
                type="number"
                min={0}
                max={99}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                aria-label="Hours"
              />
              <span>h</span>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                aria-label="Minutes"
              />
              <span>m</span>
            </div>
          </fieldset>

          <footer>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
              disabled={isPending}
            >
              Cancel
            </button>
            <button type="submit" disabled={isPending || !title.trim()} aria-busy={isPending}>
              {isPending ? 'Logging…' : 'Log Activity'}
            </button>
          </footer>
        </form>
      </article>
    </dialog>
  )
}

// ---------------------------------------------------------------------------
// EmptyFeedState
// ---------------------------------------------------------------------------

const WIDER_TAB: Record<string, { tab: TabValue; label: string } | null> = {
  daily: { tab: 'weekly', label: 'View weekly log' },
  weekly: { tab: 'monthly', label: 'View monthly log' },
  monthly: { tab: 'yearly', label: 'View yearly log' },
  yearly: null,
}

function EmptyFeedState({
  activeTab,
  onSwitchTab,
}: {
  activeTab: TabValue
  onSwitchTab: (tab: TabValue) => void
}) {
  const wider = WIDER_TAB[activeTab]
  return (
    <div className="feed-empty">
      <BookOpen size={40} />
      <p>No activity in this period.</p>
      {wider && (
        <button
          type="button"
          className="outline"
          onClick={() => onSwitchTab(wider.tab)}
        >
          {wider.label}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day card (collapsible with <details>)
// ---------------------------------------------------------------------------

function DayCard({
  day,
  editMode,
  playerName,
}: {
  day: DayData
  editMode: boolean
  playerName: string
}) {
  return (
    <details className="feed-day">
      <summary>
        <div className="feed-day-label">
          <strong>{day.dateFormatted}</strong>
          <span>{day.dayName}</span>
        </div>
        <div className="feed-day-stats">
          <span>
            <strong>{day.activityCount}</strong>{' '}
            <span>{day.activityCount === 1 ? 'activity' : 'activities'}</span>
          </span>
          <span className="duration-label">{formatDuration(day.totalMinutes)}</span>
          <CopyButton
            getText={() =>
              generatePeriodMarkdown({
                scope: 'daily',
                periodLabel: day.dateFormatted,
                items: day.items,
                playerName,
              })
            }
          />
        </div>
      </summary>

      <div className="feed-day-body" role="list" aria-label={`Activities on ${day.dateFormatted}`}>
        {day.items.map((item) => (
          <FeedItemCard key={item.id} item={item} editMode={editMode} playerName={playerName} />
        ))}
      </div>
    </details>
  )
}

// ---------------------------------------------------------------------------
// Summary card for weekly / monthly / yearly
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  activityCount,
  totalMinutes,
  getCopyText,
}: {
  label: string
  activityCount: number
  totalMinutes: number
  getCopyText: () => string
}) {
  return (
    <article className="feed-summary">
      <div className="feed-day-label">
        <strong>{label}</strong>
      </div>
      <div className="feed-day-stats">
        <span>
          <strong>{activityCount}</strong>{' '}
          <span>{activityCount === 1 ? 'activity' : 'activities'}</span>
        </span>
        <span className="duration-label">{formatDuration(totalMinutes)}</span>
        <CopyButton getText={getCopyText} />
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Main FeedTabs component
// ---------------------------------------------------------------------------

export function FeedTabs({
  days,
  weeks,
  months,
  years,
  playerFirstName,
}: {
  days: DayData[]
  weeks: WeekData[]
  months: MonthData[]
  years: YearData[]
  playerFirstName: string
}) {
  const [activeTab, setActiveTab] = useState<TabValue>('daily')
  const [editMode, setEditMode] = useState(false)
  const [logDialogOpen, setLogDialogOpen] = useState(false)

  const allItems = days.flatMap((d) => d.items)

  function getItemsForWeek(weekKey: string): FeedItem[] {
    const monday = new Date(weekKey + 'T12:00:00')
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const mondayStr = weekKey
    const sundayYear = sunday.getFullYear()
    const sundayMonth = String(sunday.getMonth() + 1).padStart(2, '0')
    const sundayDay = String(sunday.getDate()).padStart(2, '0')
    const sundayStr = `${sundayYear}-${sundayMonth}-${sundayDay}`

    return allItems.filter((item) => {
      const d = new Date(item.timestamp)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const dateKey = `${yyyy}-${mm}-${dd}`
      return dateKey >= mondayStr && dateKey <= sundayStr
    })
  }

  function getItemsForMonth(monthKey: string): FeedItem[] {
    return allItems.filter((item) => {
      const d = new Date(item.timestamp)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      return `${yyyy}-${mm}` === monthKey
    })
  }

  function getItemsForYear(yearKey: string): FeedItem[] {
    return allItems.filter((item) => {
      const d = new Date(item.timestamp)
      return String(d.getFullYear()) === yearKey
    })
  }

  const isEmpty =
    (activeTab === 'daily' && days.length === 0) ||
    (activeTab === 'weekly' && weeks.length === 0) ||
    (activeTab === 'monthly' && months.length === 0) ||
    (activeTab === 'yearly' && years.length === 0)

  return (
    <div className="log-shell">
      <header className="page-header-with-action">
        <hgroup>
          <h1>Log</h1>
          <p>Everything you&apos;ve done, plus a place to log spontaneous activities.</p>
        </hgroup>
        <button
          type="button"
          className="outline"
          onClick={() => setLogDialogOpen(true)}
        >
          <Plus size={16} /> Log Activity
        </button>
      </header>

      <SpontaneousEntryDialog open={logDialogOpen} onOpenChange={setLogDialogOpen} />

      <article className="feed-tabs-card">
        <header>
          <nav className="feed-tabs" role="tablist">
            {TAB_VALUES.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={activeTab === t}
                className={activeTab === t ? '' : 'secondary'}
                onClick={() => setActiveTab(t)}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>
          <label className="edit-mode-switch">
            <span>Edit Mode</span>
            <input
              type="checkbox"
              role="switch"
              checked={editMode}
              onChange={(e) => setEditMode(e.target.checked)}
              aria-label="Toggle edit mode"
            />
          </label>
        </header>

        {isEmpty ? (
          <EmptyFeedState activeTab={activeTab} onSwitchTab={setActiveTab} />
        ) : (
          <div className="feed-list">
            {activeTab === 'daily' &&
              days.map((day) => (
                <DayCard
                  key={day.dateKey}
                  day={day}
                  editMode={editMode}
                  playerName={playerFirstName}
                />
              ))}

            {activeTab === 'weekly' &&
              weeks.map((week) => (
                <SummaryCard
                  key={week.weekKey}
                  label={week.weekLabel}
                  activityCount={week.activityCount}
                  totalMinutes={week.totalMinutes}
                  getCopyText={() =>
                    generatePeriodMarkdown({
                      scope: 'weekly',
                      periodLabel: week.weekLabel,
                      items: getItemsForWeek(week.weekKey),
                      playerName: playerFirstName,
                    })
                  }
                />
              ))}

            {activeTab === 'monthly' &&
              months.map((month) => (
                <SummaryCard
                  key={month.monthKey}
                  label={month.monthLabel}
                  activityCount={month.activityCount}
                  totalMinutes={month.totalMinutes}
                  getCopyText={() =>
                    generatePeriodMarkdown({
                      scope: 'monthly',
                      periodLabel: month.monthLabel,
                      items: getItemsForMonth(month.monthKey),
                      playerName: playerFirstName,
                    })
                  }
                />
              ))}

            {activeTab === 'yearly' &&
              years.map((year) => (
                <SummaryCard
                  key={year.yearKey}
                  label={year.yearLabel}
                  activityCount={year.activityCount}
                  totalMinutes={year.totalMinutes}
                  getCopyText={() =>
                    generatePeriodMarkdown({
                      scope: 'yearly',
                      periodLabel: year.yearLabel,
                      items: getItemsForYear(year.yearKey),
                      playerName: playerFirstName,
                    })
                  }
                />
              ))}
          </div>
        )}
      </article>
    </div>
  )
}
