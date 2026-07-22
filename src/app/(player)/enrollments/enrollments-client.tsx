'use client'

import { useState, useEffect, useActionState, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  updateEnrollmentSettingsAction,
  toggleEnrollmentStatusAction,
  getRemainingTaskCountAction,
  finishEnrollmentAction,
  unenrollAction,
  type EnrollmentSettingsActionState,
} from './actions'
import { BookOpen, Search, X } from 'lucide-react'
import { addDaysToDateKey } from '@/lib/date-tz'

export type PlayerProfile = {
  id: string
  username: string
  first_name: string
  last_name: string
  time_zone: string
}

export type EnrollmentItem = {
  id: string
  curriculum_name: string
  enrollment_type: 'core' | 'elective' | 'memorization'
  status: 'active' | 'paused' | 'finished'
  curriculum_id: string
  curriculum_available: boolean
  target_completion_date: string | null
  start_date: string | null
  study_days_per_week: number | null
  target_loops: number | null
  grade_level: string | null
  created_at: string | null
  updated_at: string | null
}

const STATUS_ORDER: Record<EnrollmentItem['status'], number> = {
  active: 0,
  paused: 1,
  finished: 2,
}

const STUDY_DAYS_OPTIONS = Array.from({ length: 14 }, (_, i) => {
  const value = (i + 1) * 0.5
  return { value: String(value), label: `${value} ${value === 1 ? 'day' : 'days'}` }
})

type StatusFilter = 'all' | 'active' | 'paused' | 'finished'

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
// EnrollmentSettingsForm
// ---------------------------------------------------------------------------

const settingsInitialState: EnrollmentSettingsActionState = {}

function EnrollmentSettingsForm({
  enrollment,
  onSaved,
  onCancel,
  todayKey,
}: {
  enrollment: EnrollmentItem
  onSaved: () => void
  onCancel: () => void
  todayKey: string
}) {
  const [state, formAction, pending] = useActionState(updateEnrollmentSettingsAction, settingsInitialState)
  const [selectedType, setSelectedType] = useState(enrollment.enrollment_type)
  const [targetDate, setTargetDate] = useState(enrollment.target_completion_date ?? '')
  const [startDate, setStartDate] = useState(
    enrollment.start_date ?? enrollment.created_at?.split('T')[0] ?? ''
  )
  const [studyDays, setStudyDays] = useState(
    enrollment.study_days_per_week ? String(enrollment.study_days_per_week) : ''
  )
  const [targetLoops, setTargetLoops] = useState(
    enrollment.target_loops ? String(enrollment.target_loops) : ''
  )
  // Earliest selectable start date is tomorrow in the player's zone.
  const minDate = useMemo(() => addDaysToDateKey(todayKey, 1), [todayKey])

  useEffect(() => {
    if (state.success) onSaved()
  }, [state.success, onSaved])

  return (
    <form action={formAction} className="enrollment-settings-form">
      <input type="hidden" name="enrollment_id" value={enrollment.id} />

      <label htmlFor={`type-${enrollment.id}`}>
        Enrollment Type
        <input type="hidden" name="enrollment_type" value={selectedType} />
        <select
          id={`type-${enrollment.id}`}
          value={selectedType}
          onChange={(e) => {
            const val = e.target.value as EnrollmentItem['enrollment_type']
            setSelectedType(val)
            if (val === 'elective') setTargetDate('')
            if (val !== 'memorization') setTargetLoops('')
          }}
        >
          <option value="core">Core</option>
          <option value="elective">Elective</option>
          <option value="memorization">Memorization</option>
        </select>
        {state.fieldErrors?.enrollment_type && (
          <p className="field-error">{state.fieldErrors.enrollment_type[0]}</p>
        )}
      </label>

      <label htmlFor={`start-${enrollment.id}`}>
        Start Date
        <input
          id={`start-${enrollment.id}`}
          name="start_date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <small>Pacing counts from this date — nothing is behind before it.</small>
        {state.fieldErrors?.start_date && (
          <p className="field-error">{state.fieldErrors.start_date[0]}</p>
        )}
      </label>

      {(selectedType === 'core' || selectedType === 'memorization') && (
        <label htmlFor={`date-${enrollment.id}`}>
          Target Completion Date {selectedType === 'core' && <span className="required-marker">*</span>}
          <input
            id={`date-${enrollment.id}`}
            name="target_completion_date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            min={minDate}
            required
          />
          {state.fieldErrors?.target_completion_date && (
            <p className="field-error">{state.fieldErrors.target_completion_date[0]}</p>
          )}
        </label>
      )}

      {selectedType === 'elective' && (
        <label htmlFor={`date-${enrollment.id}`}>
          Target Completion Date <span>(optional)</span>
          <input
            id={`date-${enrollment.id}`}
            name="target_completion_date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            min={minDate}
          />
          {state.fieldErrors?.target_completion_date && (
            <p className="field-error">{state.fieldErrors.target_completion_date[0]}</p>
          )}
        </label>
      )}

      {selectedType === 'memorization' && (
        <label htmlFor={`loops-${enrollment.id}`}>
          Target Loops <span className="required-marker">*</span>
          <input
            id={`loops-${enrollment.id}`}
            name="target_loops"
            type="number"
            value={targetLoops}
            onChange={(e) => setTargetLoops(e.target.value)}
            min={1}
            step={1}
            required
          />
          {state.fieldErrors?.target_loops && (
            <p className="field-error">{state.fieldErrors.target_loops[0]}</p>
          )}
        </label>
      )}

      <label htmlFor={`days-${enrollment.id}`}>
        Study Days per Week
        <input type="hidden" name="study_days_per_week" value={studyDays} />
        <select
          id={`days-${enrollment.id}`}
          value={studyDays}
          onChange={(e) => setStudyDays(e.target.value)}
        >
          <option value="" disabled>Select study days</option>
          {STUDY_DAYS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.study_days_per_week && (
          <p className="field-error">{state.fieldErrors.study_days_per_week[0]}</p>
        )}
      </label>

      {state.error && (
        <p className="form-error" role="alert">{state.error}</p>
      )}

      <div className="form-actions">
        <button type="submit" disabled={pending || !studyDays} aria-busy={pending}>
          {pending ? 'Saving…' : 'Save Settings'}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// EnrollmentRow
// ---------------------------------------------------------------------------

function formatEnrolledDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// For bare YYYY-MM-DD strings; anchor to local midnight so the day doesn't shift
function formatDateOnly(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTarget(enrollment: EnrollmentItem): string {
  if (enrollment.target_completion_date) {
    return `Target: ${new Date(enrollment.target_completion_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  return 'Target: Ongoing'
}

function EnrollmentRow({ enrollment, todayKey }: { enrollment: EnrollmentItem; todayKey: string }) {
  const [editingSettings, setEditingSettings] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [remainingCount, setRemainingCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)
  const [unenrollDialogOpen, setUnenrollDialogOpen] = useState(false)
  const [unenrolling, setUnenrolling] = useState(false)
  const [unenrollError, setUnenrollError] = useState<string | null>(null)

  const finishDialogRef = useNativeDialog(finishDialogOpen, () => setFinishDialogOpen(false))
  const unenrollDialogRef = useNativeDialog(unenrollDialogOpen, () => setUnenrollDialogOpen(false))

  const handleToggleStatus = async () => {
    setToggling(true)
    setToggleError(null)
    const newStatus = enrollment.status === 'active' ? 'paused' : 'active'
    const result = await toggleEnrollmentStatusAction(enrollment.id, newStatus)
    if (result.error) {
      setToggleError(result.error)
    }
    setToggling(false)
  }

  const handleOpenFinishDialog = async () => {
    setLoadingCount(true)
    setFinishError(null)
    const result = await getRemainingTaskCountAction(enrollment.id)
    setRemainingCount(result.count)
    setLoadingCount(false)
    setFinishDialogOpen(true)
  }

  const handleUnenroll = async () => {
    setUnenrolling(true)
    setUnenrollError(null)
    const result = await unenrollAction(enrollment.id)
    if (result.error) {
      setUnenrollError(result.error)
      setUnenrolling(false)
    } else {
      setUnenrollDialogOpen(false)
      setUnenrolling(false)
    }
  }

  const handleFinish = async () => {
    setFinishing(true)
    setFinishError(null)
    const result = await finishEnrollmentAction(enrollment.id)
    if (result.error) {
      setFinishError(result.error)
      setFinishing(false)
    } else {
      setFinishDialogOpen(false)
      setFinishing(false)
    }
  }

  const studyDaysLabel = enrollment.study_days_per_week
    ? `Study Days: ${enrollment.study_days_per_week}/week`
    : null

  return (
    <article className="enrollment-row" data-status={enrollment.status}>
      <div className="enrollment-row-grid">
        <div className="enrollment-info">
          {enrollment.curriculum_available ? (
            <Link href={`/curriculums/${enrollment.curriculum_id}`} className="enrollment-name">
              <strong>{enrollment.curriculum_name}</strong>
            </Link>
          ) : (
            <em className="enrollment-name unavailable">Curriculum unavailable</em>
          )}
          {enrollment.created_at && (
            <p className="enrollment-meta-line">
              Enrolled on {formatEnrolledDate(enrollment.created_at)}
              {enrollment.start_date && enrollment.start_date !== enrollment.created_at.split('T')[0] && (
                <>
                  {' — '}
                  {enrollment.start_date > todayKey ? 'Starts' : 'Started'} on{' '}
                  {formatDateOnly(enrollment.start_date)}
                </>
              )}
              {enrollment.status === 'finished' && enrollment.updated_at && (
                <> — Finished on {formatEnrolledDate(enrollment.updated_at)}</>
              )}
            </p>
          )}
          <p className="enrollment-meta-line">
            {[studyDaysLabel, formatTarget(enrollment)].filter(Boolean).join(' | ')}
          </p>
        </div>

        <div className="enrollment-actions">
          {enrollment.status !== 'finished' && (
            <button
              type="button"
              className="outline"
              onClick={() => setEditingSettings(!editingSettings)}
              aria-label="Edit enrollment settings"
            >
              Edit Settings
            </button>
          )}
          {enrollment.curriculum_available && (
            <Link
              href={`/curriculums/${enrollment.curriculum_id}`}
              role="button"
              className="outline"
            >
              View
            </Link>
          )}
          {enrollment.status === 'active' && (
            <button
              type="button"
              className="outline"
              onClick={handleToggleStatus}
              disabled={toggling}
              aria-label={`Pause ${enrollment.curriculum_name}`}
            >
              Pause
            </button>
          )}
          {enrollment.status === 'paused' && (
            <button
              type="button"
              className="outline"
              onClick={handleToggleStatus}
              disabled={toggling}
              aria-label={`Resume ${enrollment.curriculum_name}`}
            >
              Resume
            </button>
          )}
          {enrollment.status === 'finished' ? (
            <button type="button" className="outline" disabled>
              Finished ✓
            </button>
          ) : (
            <>
              <button
                type="button"
                className="outline"
                onClick={handleOpenFinishDialog}
                disabled={loadingCount}
                aria-label={`Finish ${enrollment.curriculum_name}`}
              >
                Finish
              </button>
              <button
                type="button"
                className="contrast"
                onClick={() => setUnenrollDialogOpen(true)}
                aria-label={`Unenroll from ${enrollment.curriculum_name}`}
              >
                Unenroll
              </button>
            </>
          )}
        </div>
      </div>

      {(toggleError || finishError || unenrollError) && (
        <p className="row-error">{toggleError || finishError || unenrollError}</p>
      )}

      {editingSettings && (
        <EnrollmentSettingsForm
          enrollment={enrollment}
          onSaved={() => setEditingSettings(false)}
          onCancel={() => setEditingSettings(false)}
          todayKey={todayKey}
        />
      )}

      <dialog ref={finishDialogRef}>
        <article>
          <header>
            <h3>Finish enrollment</h3>
            <p>
              {remainingCount !== null && remainingCount > 0
                ? `This will skip ${remainingCount} remaining ${remainingCount === 1 ? 'task' : 'tasks'} and mark this enrollment as finished. This cannot be undone.`
                : 'This will mark this enrollment as finished. This cannot be undone.'}
            </p>
          </header>
          <p>
            &ldquo;{enrollment.curriculum_name}&rdquo; will be moved to the finished list.
            You cannot unpause or resume a finished enrollment.
          </p>
          {finishError && <p className="form-error">{finishError}</p>}
          <footer>
            <button
              type="button"
              className="secondary"
              onClick={() => setFinishDialogOpen(false)}
              disabled={finishing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="contrast"
              onClick={handleFinish}
              disabled={finishing}
              aria-busy={finishing}
            >
              {finishing ? 'Finishing…' : 'Finish enrollment'}
            </button>
          </footer>
        </article>
      </dialog>

      <dialog ref={unenrollDialogRef}>
        <article>
          <header>
            <h3>Unenroll from curriculum</h3>
            <p>
              This will permanently delete this enrollment and all associated
              completion history and time records. This cannot be undone.
            </p>
          </header>
          <p>
            &ldquo;{enrollment.curriculum_name}&rdquo; will be removed from your enrollments.
            The curriculum itself will not be deleted.
          </p>
          {unenrollError && <p className="form-error">{unenrollError}</p>}
          <footer>
            <button
              type="button"
              className="secondary"
              onClick={() => setUnenrollDialogOpen(false)}
              disabled={unenrolling}
            >
              Cancel
            </button>
            <button
              type="button"
              className="contrast"
              onClick={handleUnenroll}
              disabled={unenrolling}
              aria-busy={unenrolling}
            >
              {unenrolling ? 'Unenrolling…' : 'Unenroll'}
            </button>
          </footer>
        </article>
      </dialog>
    </article>
  )
}

// ---------------------------------------------------------------------------
// EnrollmentsClient
// ---------------------------------------------------------------------------

export function EnrollmentsClient({
  enrollments,
  todayKey,
}: {
  player: PlayerProfile
  enrollments: EnrollmentItem[]
  todayKey: string
}) {
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('q') ?? ''
  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [gradeFilter, setGradeFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(value)
    }, 250)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const clearSearch = useCallback(() => {
    setSearch('')
    setDebouncedSearch('')
    if (timerRef.current) clearTimeout(timerRef.current)
    inputRef.current?.focus()
  }, [])

  const clearFilters = useCallback(() => {
    setSearch('')
    setDebouncedSearch('')
    setGradeFilter('all')
    setTypeFilter('all')
    setStatusFilter('all')
    if (timerRef.current) clearTimeout(timerRef.current)
    inputRef.current?.focus()
  }, [])

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>()
    for (const e of enrollments) {
      if (e.grade_level) grades.add(e.grade_level)
    }
    return Array.from(grades).sort()
  }, [enrollments])

  const sorted = useMemo(
    () => [...enrollments].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [enrollments]
  )

  const filtered = useMemo(() => {
    let items = sorted
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.trim().toLowerCase()
      items = items.filter((e) => e.curriculum_name.toLowerCase().includes(term))
    }
    if (gradeFilter !== 'all') {
      items = items.filter((e) => e.grade_level === gradeFilter)
    }
    if (typeFilter !== 'all') {
      items = items.filter((e) => e.enrollment_type === typeFilter)
    }
    if (statusFilter !== 'all') {
      items = items.filter((e) => e.status === statusFilter)
    }
    return items
  }, [sorted, debouncedSearch, gradeFilter, typeFilter, statusFilter])

  if (enrollments.length === 0) {
    return (
      <div className="enrollments-shell">
        <hgroup className="enrollments-header">
          <h1>My Enrollments</h1>
          <p>View and manage all your enrollments.</p>
        </hgroup>
        <article className="enrollments-empty">
          <BookOpen size={40} />
          <p>No active enrollments.</p>
          <div className="empty-actions">
            <Link href="/curriculums" role="button" className="outline">
              Add or browse your own curriculums
            </Link>
            <Link href="/discover" role="button" className="outline">
              Discover new curriculums
            </Link>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="enrollments-shell">
      <hgroup className="enrollments-header">
        <h1>My Enrollments</h1>
        <p>View and manage all your enrollments.</p>
      </hgroup>

      <div className="enrollments-filters">
        <div className="search-wrap">
          <Search size={16} className="search-icon" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            placeholder="Filter your enrollments by keyword..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Search enrollments"
          />
          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {gradeOptions.length > 0 && (
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            aria-label="Filter by grade"
          >
            <option value="all">All Grades</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        )}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="all">All Types</option>
          <option value="core">Core</option>
          <option value="elective">Elective</option>
          <option value="memorization">Memorization</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="all">All Enrollments</option>
          <option value="active">Active Enrollments</option>
          <option value="paused">Paused Enrollments</option>
          <option value="finished">Finished Enrollments</option>
        </select>
      </div>

      <div className="enrollments-list">
        {filtered.length === 0 ? (
          <article className="enrollments-no-match">
            <p>No enrollments match your filters.</p>
            <button type="button" className="outline" onClick={clearFilters}>
              Clear filters
            </button>
          </article>
        ) : (
          <ul>
            {filtered.map((enrollment) => (
              <li key={enrollment.id}>
                <EnrollmentRow enrollment={enrollment} todayKey={todayKey} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
