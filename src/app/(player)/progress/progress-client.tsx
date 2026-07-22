'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, BookOpen, Clock, Search, X } from 'lucide-react'
import { DotPlot } from '@/components/dot-plot'
import type { PacingStatus } from '@/lib/daily-goal'

export type ProgressEnrollment = {
  enrollmentId: string
  enrollmentStatus: 'active' | 'paused' | 'finished'
  curriculumName: string
  gradeLevel: string | null
  enrollmentType: 'core' | 'elective' | 'memorization'
  completionPercent: number
  status: PacingStatus
  tasksDelta: number
  completionDates: string[]
  completionStatuses: string[]
  startDate: string
}

type StatusFilter = 'all' | 'active' | 'paused' | 'finished'

function StatusText({ status, tasksDelta }: { status: PacingStatus; tasksDelta: number }) {
  switch (status) {
    case 'behind':
    case 'overdue':
      return (
        <span className="pacing-behind">
          {Math.abs(tasksDelta)} task{Math.abs(tasksDelta) !== 1 ? 's' : ''} behind
        </span>
      )
    case 'on-track':
      return <span className="pacing-ontrack">On track</span>
    case 'ahead':
      return <span className="pacing-ahead">Ahead</span>
    case 'ongoing':
      return <span className="pacing-ongoing">Ongoing</span>
  }
}

export function ProgressClient({
  enrollments,
  rollupStatus,
  totalBehind,
  timeZone,
}: {
  enrollments: ProgressEnrollment[]
  rollupStatus: PacingStatus
  totalBehind: number
  timeZone: string
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isBehind = rollupStatus === 'behind' || rollupStatus === 'overdue'

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedSearch(value), 250)
  }, [])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>()
    for (const e of enrollments) {
      if (e.gradeLevel) grades.add(e.gradeLevel)
    }
    return Array.from(grades).sort()
  }, [enrollments])

  const filtered = useMemo(() => {
    let items = enrollments
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.trim().toLowerCase()
      items = items.filter((e) => e.curriculumName.toLowerCase().includes(term))
    }
    if (gradeFilter !== 'all') {
      items = items.filter((e) => e.gradeLevel === gradeFilter)
    }
    if (typeFilter !== 'all') {
      items = items.filter((e) => e.enrollmentType === typeFilter)
    }
    if (statusFilter !== 'all') {
      items = items.filter((e) => e.enrollmentStatus === statusFilter)
    }
    return items
  }, [enrollments, debouncedSearch, gradeFilter, typeFilter, statusFilter])

  if (enrollments.length === 0) {
    return (
      <article className="progress-empty">
        <BookOpen size={40} />
        <p>No enrollments.</p>
        <Link href="/curriculums" role="button" className="outline">
          Browse curriculums to enroll
        </Link>
      </article>
    )
  }

  return (
    <>
      <div className="progress-filters">
        <div className="search-wrap">
          <Search size={16} className="search-icon" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            placeholder="Filter your enrollments by keyword..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Filter enrollments"
          />
          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => { setSearch(''); setDebouncedSearch(''); inputRef.current?.focus() }}
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
            {gradeOptions.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
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

      {isBehind && statusFilter !== 'finished' && (
        <article className="rollup-banner" role="status">
          {rollupStatus === 'overdue' ? <Clock size={16} /> : <AlertTriangle size={16} />}
          <span>
            {totalBehind} task{totalBehind !== 1 ? 's' : ''} behind across your enrollments
          </span>
        </article>
      )}

      {filtered.length > 0 ? (
        <ul className="progress-list">
          {filtered.map((enrollment) => (
            <li key={enrollment.enrollmentId}>
              <article
                className="progress-row"
                data-pacing={enrollment.status}
                data-status={enrollment.enrollmentStatus}
              >
                <div className="progress-row-grid">
                  <div className="progress-info">
                    <strong>{enrollment.curriculumName}</strong>
                    <div className="progress-row-meta">
                      <span>Completion: {enrollment.completionPercent}%</span>
                      <span>
                        Status:{' '}
                        {enrollment.enrollmentStatus === 'finished' ? (
                          <span className="pacing-ahead">Finished</span>
                        ) : (
                          <StatusText status={enrollment.status} tasksDelta={enrollment.tasksDelta} />
                        )}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/enrollments?q=${encodeURIComponent(enrollment.curriculumName)}`}
                    role="button"
                    className="outline"
                  >
                    Manage
                  </Link>
                </div>
                {(() => {
                  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
                  const latestCompletion = enrollment.completionDates.reduce<number>(
                    (max, iso) => Math.max(max, new Date(iso).getTime()),
                    0,
                  )
                  const isFinishedAndStale =
                    enrollment.enrollmentStatus === 'finished' &&
                    (latestCompletion === 0 || Date.now() - latestCompletion > SEVEN_DAYS_MS)
                  return isFinishedAndStale ? null : (
                    <DotPlot
                      completionDates={enrollment.completionDates}
                      completionStatuses={enrollment.completionStatuses}
                      startDate={enrollment.startDate}
                      enrollmentId={enrollment.enrollmentId}
                      timeZone={timeZone}
                    />
                  )
                })()}
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="progress-no-match">
          No {statusFilter === 'all' ? '' : statusFilter} enrollments to show.
        </p>
      )}
    </>
  )
}
