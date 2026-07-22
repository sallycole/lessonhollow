'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { BookOpen, Check, Search, X } from 'lucide-react'

export type CurriculumListItem = {
  id: string
  name: string
  description: string | null
  publisher: string | null
  grade_level: string | null
  task_count: number
  created_at: string
  is_enrolled: boolean
}

type StatusFilter = 'all' | 'enrolled' | 'not-enrolled'

export function CurriculumsList({ curricula }: { curricula: CurriculumListItem[] }) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
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

  const clearAllFilters = useCallback(() => {
    setSearch('')
    setDebouncedSearch('')
    setGradeFilter('all')
    setStatusFilter('all')
    if (timerRef.current) clearTimeout(timerRef.current)
    inputRef.current?.focus()
  }, [])

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>()
    for (const c of curricula) {
      if (c.grade_level) grades.add(c.grade_level)
    }
    return Array.from(grades).sort()
  }, [curricula])

  const filtered = useMemo(() => {
    let items = curricula
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.trim().toLowerCase()
      items = items.filter((c) => c.name.toLowerCase().includes(term))
    }
    if (gradeFilter !== 'all') {
      items = items.filter((c) => c.grade_level === gradeFilter)
    }
    if (statusFilter === 'enrolled') {
      items = items.filter((c) => c.is_enrolled)
    } else if (statusFilter === 'not-enrolled') {
      items = items.filter((c) => !c.is_enrolled)
    }
    return items
  }, [curricula, debouncedSearch, gradeFilter, statusFilter])

  if (curricula.length === 0) {
    return (
      <article className="curriculums-empty">
        <BookOpen size={40} />
        <p>No curriculums yet.</p>
        <Link href="/curriculums/new" role="button" className="outline">
          Create your first curriculum
        </Link>
      </article>
    )
  }

  return (
    <>
      <div className="curriculums-filters">
        <div className="search-wrap">
          <Search size={16} className="search-icon" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            placeholder="Filter your curriculums by keyword..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Search curriculums"
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="enrolled">Enrolled</option>
          <option value="not-enrolled">Not Enrolled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <article className="curriculums-no-match">
          <p>No curriculums match your filters.</p>
          <button type="button" className="outline" onClick={clearAllFilters}>
            Clear filters
          </button>
        </article>
      ) : (
        <div className="curriculums-grid">
          {filtered.map((c) => (
            <article key={c.id} className="curriculum-card">
              <h4 className="curriculum-name">{c.name}</h4>
              {c.description && <p className="task-description">{c.description}</p>}
              {c.publisher && <p className="task-description"><strong>Publisher:</strong> {c.publisher}</p>}
              {c.grade_level && <p className="task-description"><strong>Grade Levels:</strong> {c.grade_level}</p>}
              <footer>
                <Link href={`/curriculums/${c.id}`} role="button" className="outline">
                  View
                </Link>
                {c.is_enrolled ? (
                  <span className="enrolled-badge">
                    <Check size={14} /> Enrolled
                  </span>
                ) : (
                  <Link href={`/curriculums/${c.id}/enroll`} role="button">
                    Enroll
                  </Link>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
