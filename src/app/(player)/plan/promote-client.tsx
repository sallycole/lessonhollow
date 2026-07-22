'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  ArrowUp,
  BookOpen,
  Check,
  ExternalLink,
  Loader2,
  ChevronsDown,
  ChevronsUp,
  SkipForward,
} from 'lucide-react'
import Link from 'next/link'
import {
  promoteNextTaskAction,
  promoteSpecificTaskAction,
  skipTaskAction,
  fetchAllUpcomingTasksAction,
} from './actions'
import type { ProgressStatusResult } from '@/lib/progress-status'
import { ProgressStatusBadge } from '@/components/progress-status-badge'

export type UpcomingTask = {
  task_id: string
  title: string
  description: string | null
  resource_url: string | null
  action_type: 'Read' | 'Watch' | 'Listen' | 'Do'
  status: 'pending' | 'promoted'
  loop_number: number
}

export type PromoteEnrollment = {
  id: string
  curriculum_id: string
  curriculum_name: string
  enrollment_type: 'core' | 'elective' | 'memorization'
  status: 'active' | 'paused' | 'finished'
  start_date: string
  next_task_title: string | null
  current_loop: number
  upcoming_tasks: UpcomingTask[]
  totalTasks: number
  completedTasks: number
  percentComplete: number
  progressStatus: ProgressStatusResult
  completedLoops?: number
  targetLoops?: number
  completedTasksInCurrentLoop?: number
  effectiveTotalTasks?: number
  finished_at?: string
  grade_level?: string | null
}

// For bare YYYY-MM-DD strings; anchor to local midnight so the day doesn't shift
function formatDateOnly(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

function TaskRow({
  task,
  enrollmentId,
  onPromoted,
  onSkipRequested,
}: {
  task: UpcomingTask
  enrollmentId: string
  onPromoted: (taskId: string) => void
  onSkipRequested: (task: UpcomingTask) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [justPromoted, setJustPromoted] = useState(false)

  const handlePromote = useCallback(() => {
    startTransition(async () => {
      const result = await promoteSpecificTaskAction(
        enrollmentId,
        task.task_id,
        task.loop_number,
      )
      if (result.success) {
        setJustPromoted(true)
        onPromoted(task.task_id)
        setTimeout(() => setJustPromoted(false), 1500)
      }
    })
  }, [enrollmentId, task.task_id, task.loop_number, onPromoted])

  const isAlreadyPromoted = task.status === 'promoted' || justPromoted

  return (
    <article className="plan-task-row">
      <div className="plan-task-content">
        <div className="plan-task-title">
          <span className="action-badge">{task.action_type}</span>
          <strong>{task.title}</strong>
          {task.resource_url && (
            <a
              href={task.resource_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open resource"
              className="task-resource"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        {task.description && <p className="plan-task-desc">{task.description}</p>}
      </div>
      <div className="plan-task-actions">
        {isAlreadyPromoted ? (
          <button type="button" className="outline" disabled>
            Promoted ✓
          </button>
        ) : (
          <>
            <button
              type="button"
              className="icon-button"
              disabled={isPending}
              onClick={() => onSkipRequested(task)}
              aria-label={`Skip ${task.title}`}
            >
              <SkipForward size={18} />
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handlePromote}
              aria-label={`Promote ${task.title}`}
              aria-busy={isPending}
            >
              {isPending ? <Loader2 size={14} /> : <><ArrowUp size={14} /> Promote</>}
            </button>
          </>
        )}
      </div>
    </article>
  )
}

function EnrollmentProgressBar({ enrollment }: { enrollment: PromoteEnrollment }) {
  const isMemo = enrollment.enrollment_type === 'memorization'
  const showOnTrack = enrollment.progressStatus.status !== 'no_target'

  if (isMemo) {
    const completedLoops = enrollment.completedLoops ?? 0
    const targetLoops = enrollment.targetLoops ?? 1
    const tasksInLoop = enrollment.completedTasksInCurrentLoop ?? 0
    const effectiveTotal = enrollment.effectiveTotalTasks ?? 1
    const isComplete = enrollment.progressStatus.status === 'complete'

    const fractional = effectiveTotal > 0 ? tasksInLoop / effectiveTotal : 0
    const displayLoops = completedLoops + fractional
    const percentComplete = targetLoops > 0
      ? Math.min(Math.round((displayLoops / targetLoops) * 100), 100)
      : 0

    const displayValue =
      fractional > 0 && !isComplete
        ? `${displayLoops.toFixed(1)} / ${targetLoops} loops`
        : `${completedLoops} / ${targetLoops} loops`

    return (
      <div className="plan-progress-row">
        <div className="plan-progress-meta">
          <span>
            {displayValue} ({percentComplete}%)
          </span>
          {showOnTrack && <ProgressStatusBadge progressStatus={enrollment.progressStatus} />}
        </div>
        <progress value={percentComplete} max={100} aria-label={`${enrollment.curriculum_name} progress`} />
      </div>
    )
  }

  return (
    <div className="plan-progress-row">
      <div className="plan-progress-meta">
        <span>
          {enrollment.completedTasks} / {enrollment.totalTasks} tasks ({enrollment.percentComplete}%)
        </span>
        {showOnTrack && <ProgressStatusBadge progressStatus={enrollment.progressStatus} />}
      </div>
      <progress
        value={Math.min(enrollment.percentComplete, 100)}
        max={100}
        aria-label={`${enrollment.curriculum_name} progress`}
      />
    </div>
  )
}

function ActiveEnrollmentCard({
  enrollment,
  todayKey,
  isExpanded,
  onToggleExpand,
}: {
  enrollment: PromoteEnrollment
  todayKey: string
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [justPromoted, setJustPromoted] = useState(false)
  const [upcomingTasks, setUpcomingTasks] = useState(enrollment.upcoming_tasks)
  const [skipTarget, setSkipTarget] = useState<UpcomingTask | null>(null)
  const [isSkipping, startSkipTransition] = useTransition()
  const [allTasks, setAllTasks] = useState<UpcomingTask[] | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const skipDialogRef = useNativeDialog(skipTarget !== null, () => setSkipTarget(null))

  const hasNextTask = enrollment.next_task_title !== null
  const isDisabled = !hasNextTask || isPending || justPromoted
  const hasUpcoming = upcomingTasks.length > 0

  const ensureAllTasks = useCallback(
    async (force = false) => {
      if (!force && allTasks) return allTasks
      const { tasks } = await fetchAllUpcomingTasksAction(enrollment.id)
      setAllTasks(tasks)
      return tasks
    },
    [enrollment.id, allTasks],
  )

  const handlePromote = useCallback(() => {
    startTransition(async () => {
      const result = await promoteNextTaskAction(enrollment.id)
      if (result.success) {
        setJustPromoted(true)
        setTimeout(() => setJustPromoted(false), 1500)
      }
    })
  }, [enrollment.id])

  const handleTaskPromoted = useCallback(
    async (taskId: string) => {
      const updated = upcomingTasks.map((t) =>
        t.task_id === taskId ? { ...t, status: 'promoted' as const } : t,
      )
      const allTasksLocal = await ensureAllTasks()
      const visibleSet = new Set(upcomingTasks.map((t) => t.task_id))
      const next = allTasksLocal.find((t) => !visibleSet.has(t.task_id))
      setUpcomingTasks(next ? [...updated, next] : updated)
    },
    [upcomingTasks, ensureAllTasks],
  )

  const handleSkipRequested = useCallback((task: UpcomingTask) => {
    setSkipTarget(task)
  }, [])

  const handleShowMore = useCallback(async () => {
    setIsLoadingMore(true)
    const allTasksLocal = await ensureAllTasks()
    const visibleSet = new Set(upcomingTasks.map((t) => t.task_id))
    const additional = allTasksLocal
      .filter((t) => !visibleSet.has(t.task_id))
      .slice(0, 5)
    setUpcomingTasks((prev) => [...prev, ...additional])
    setIsLoadingMore(false)
  }, [upcomingTasks, ensureAllTasks])

  const handleConfirmSkip = useCallback(() => {
    if (!skipTarget) return
    const task = skipTarget
    startSkipTransition(async () => {
      const result = await skipTaskAction(enrollment.id, task.task_id, task.loop_number)
      if (result.success) {
        setSkipTarget(null)
        const freshTasks = await ensureAllTasks(true)
        const remaining = upcomingTasks.filter((t) => t.task_id !== task.task_id)
        const visibleSet = new Set(remaining.map((t) => t.task_id))
        const next = freshTasks.find((t) => !visibleSet.has(t.task_id))
        setUpcomingTasks(next ? [...remaining, next] : remaining)
      }
    })
  }, [skipTarget, enrollment.id, upcomingTasks, ensureAllTasks])

  return (
    <article className="plan-enrollment">
      <header>
        <hgroup className="enrollment-title">
          <h4>
            <Link href={`/curriculums/${enrollment.curriculum_id}`}>
              {enrollment.curriculum_name}
            </Link>
          </h4>
          {enrollment.enrollment_type === 'memorization' && (
            <p>Loop {enrollment.current_loop}</p>
          )}
          {enrollment.start_date > todayKey && (
            <p className="starts-date-line">Starts {formatDateOnly(enrollment.start_date)}</p>
          )}
          {!isExpanded && hasNextTask && !justPromoted && (
            <p className="next-task-line">Next: {enrollment.next_task_title}</p>
          )}
          {justPromoted && <p className="promoted-line">Promoted ✓</p>}
          {!hasNextTask && !isExpanded && <p className="all-done-line">All done! ✓</p>}
        </hgroup>
        <div className="enrollment-actions">
          {!isExpanded && hasNextTask && (
            <button
              type="button"
              className={justPromoted ? 'outline' : undefined}
              disabled={isDisabled}
              onClick={handlePromote}
              title={`Promote: ${enrollment.next_task_title}`}
              aria-busy={isPending}
            >
              {isPending ? (
                <Loader2 size={18} />
              ) : justPromoted ? (
                <Check size={18} />
              ) : (
                <>
                  <ArrowUp size={18} /> Promote
                </>
              )}
            </button>
          )}
          {!isExpanded && !hasNextTask && <span className="all-done-line">All done! ✓</span>}
          <button
            type="button"
            className="outline enrollment-toggle"
            onClick={onToggleExpand}
            aria-label={isExpanded ? 'Collapse enrollment' : 'Expand enrollment'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronsUp size={18} /> : <ChevronsDown size={18} />}
          </button>
        </div>
      </header>

      {isExpanded && (
        <>
          <EnrollmentProgressBar enrollment={enrollment} />
          <div className="enrollment-body">
            {hasUpcoming ? (
              <>
                <ul className="task-row-list">
                  {upcomingTasks.map((task) => (
                    <li key={task.task_id}>
                      <TaskRow
                        task={task}
                        enrollmentId={enrollment.id}
                        onPromoted={handleTaskPromoted}
                        onSkipRequested={handleSkipRequested}
                      />
                    </li>
                  ))}
                </ul>
                {(() => {
                  const remainingTasks = enrollment.totalTasks - enrollment.completedTasks
                  const hasMore = allTasks
                    ? allTasks.some(
                        (t) => !upcomingTasks.some((u) => u.task_id === t.task_id),
                      )
                    : remainingTasks > upcomingTasks.length
                  return hasMore ? (
                    <p className="show-more-row">
                      <button
                        type="button"
                        className="outline"
                        onClick={handleShowMore}
                        disabled={isLoadingMore}
                        aria-busy={isLoadingMore}
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 size={14} /> Loading…
                          </>
                        ) : (
                          'Show 5 More'
                        )}
                      </button>
                    </p>
                  ) : null
                })()}
              </>
            ) : (
              <p className="no-upcoming">No upcoming tasks</p>
            )}
          </div>
        </>
      )}

      <dialog ref={skipDialogRef}>
        <article>
          <header>
            <h3>Skip task?</h3>
            <p>
              Are you sure you want to skip &ldquo;{skipTarget?.title}&rdquo;? This
              task will be marked as skipped and won&apos;t appear in your upcoming
              list.
            </p>
          </header>
          <footer>
            <button
              type="button"
              className="secondary"
              onClick={() => setSkipTarget(null)}
              disabled={isSkipping}
            >
              Cancel
            </button>
            <button
              type="button"
              className="contrast"
              onClick={handleConfirmSkip}
              disabled={isSkipping}
              aria-busy={isSkipping}
            >
              {isSkipping ? 'Skipping…' : 'Skip'}
            </button>
          </footer>
        </article>
      </dialog>
    </article>
  )
}

type TypeFilter = 'all' | 'core' | 'elective' | 'memorization'
type ViewFilter = 'current' | 'future'

export function PromoteClient({
  enrollments,
  todayKey,
}: {
  enrollments: PromoteEnrollment[]
  todayKey: string
}) {
  const activeEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === 'active'),
    [enrollments],
  )

  // Player-local today (computed server-side), so start-date gating doesn't
  // flip a day early in the evening on the UTC server.
  const today = todayKey
  const currentEnrollments = useMemo(
    () => activeEnrollments.filter((e) => !e.start_date || e.start_date <= today),
    [activeEnrollments, today],
  )
  const futureEnrollments = useMemo(
    () => activeEnrollments.filter((e) => e.start_date > today),
    [activeEnrollments, today],
  )

  const [collapsedEnrollments, setCollapsedEnrollments] = useState<Set<string>>(
    new Set(),
  )
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('current')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const clearFilters = useCallback(() => {
    setSearch('')
    setDebouncedSearch('')
    setGradeFilter('all')
    setTypeFilter('all')
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>()
    for (const e of activeEnrollments) {
      if (e.grade_level) grades.add(e.grade_level)
    }
    return Array.from(grades).sort()
  }, [activeEnrollments])

  const filtered = useMemo(() => {
    let items = viewFilter === 'future' ? futureEnrollments : currentEnrollments
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
    return items
  }, [currentEnrollments, futureEnrollments, viewFilter, debouncedSearch, gradeFilter, typeFilter])

  const allCollapsed =
    filtered.length > 0 && filtered.every((e) => collapsedEnrollments.has(e.id))

  const handleToggleAll = useCallback(() => {
    setCollapsedEnrollments((prev) => {
      const next = new Set(prev)
      if (allCollapsed) {
        for (const e of filtered) next.delete(e.id)
      } else {
        for (const e of filtered) next.add(e.id)
      }
      return next
    })
  }, [allCollapsed, filtered])

  const handleToggleEnrollment = useCallback((enrollmentId: string) => {
    setCollapsedEnrollments((prev) => {
      const next = new Set(prev)
      if (next.has(enrollmentId)) next.delete(enrollmentId)
      else next.add(enrollmentId)
      return next
    })
  }, [])

  if (activeEnrollments.length === 0) {
    return (
      <div className="plan-shell">
        <header className="page-header-with-action">
          <hgroup>
            <h1>Plan Your Day</h1>
            <p>Build your to do list for today.</p>
          </hgroup>
        </header>
        <article className="plan-empty">
          <BookOpen size={40} aria-hidden="true" />
          <p>No active enrollments.</p>
          <Link href="/curriculums" role="button" className="outline">
            Browse curriculums to enroll
          </Link>
        </article>
      </div>
    )
  }

  return (
    <div className="plan-shell">
      <header className="page-header-with-action">
        <hgroup>
          <h1>Plan Your Day</h1>
          <p>Build your to do list for today.</p>
        </hgroup>
        {filtered.length > 0 && (
          <button
            type="button"
            className="outline"
            onClick={handleToggleAll}
          >
            {allCollapsed ? (
              <>
                <ChevronsDown size={16} /> Expand All
              </>
            ) : (
              <>
                <ChevronsUp size={16} /> Collapse All
              </>
            )}
          </button>
        )}
      </header>

      <div className="plan-filters">
        <input
          type="search"
          placeholder="Filter your enrollments by keyword…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          aria-label="Search enrollments"
        />
        {gradeOptions.length > 0 && (
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            aria-label="Filter by grade"
          >
            <option value="all">All Grades</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          aria-label="Filter by type"
        >
          <option value="all">All Types</option>
          <option value="core">Core</option>
          <option value="elective">Elective</option>
          <option value="memorization">Memorization</option>
        </select>
        <select
          value={viewFilter}
          onChange={(e) => setViewFilter(e.target.value as ViewFilter)}
          aria-label="Show current or future enrollments"
        >
          <option value="current">Current</option>
          <option value="future">
            Future{futureEnrollments.length > 0 ? ` (${futureEnrollments.length})` : ''}
          </option>
        </select>
      </div>

      {filtered.length === 0 ? (
        viewFilter === 'future' && futureEnrollments.length === 0 ? (
          <article className="plan-empty">
            <p>No future enrollments. When you enroll with a start date after today, it will appear here until it begins.</p>
            <button type="button" className="outline" onClick={() => setViewFilter('current')}>
              Show current
            </button>
          </article>
        ) : viewFilter === 'current' && currentEnrollments.length === 0 ? (
          <article className="plan-empty">
            <p>No current enrollments yet — everything here starts in the future.</p>
            <button type="button" className="outline" onClick={() => setViewFilter('future')}>
              Show future
            </button>
          </article>
        ) : (
          <article className="plan-empty">
            <p>No enrollments match your filters.</p>
            <button type="button" className="outline" onClick={clearFilters}>
              Clear filters
            </button>
          </article>
        )
      ) : (
        <>
          <div className="plan-list">
            {filtered.map((enrollment) => (
              <ActiveEnrollmentCard
                key={enrollment.id}
                enrollment={enrollment}
                todayKey={todayKey}
                isExpanded={!collapsedEnrollments.has(enrollment.id)}
                onToggleExpand={() => handleToggleEnrollment(enrollment.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
