'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { loadMoreCurricula } from './actions'

type Curriculum = {
  id: string
  public_title: string | null
  name: string
  public_description: string | null
  publisher_name: string | null
  published_at: string | null
  copy_count: number
  grade_level: string | null
  tasks: { count: number }[]
}

type SortOption = 'newest' | 'oldest' | 'az' | 'za'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest to Oldest' },
  { value: 'oldest', label: 'Oldest to Newest' },
  { value: 'az', label: 'A–Z' },
  { value: 'za', label: 'Z–A' },
]

type CurriculumOverride = { title: string; slug: string; backgroundImage?: string }

// Display labels for grade_level values on the discover cards. Falls back to
// the raw value when there's no override.
const GRADE_LABELS: Record<string, string> = {
  Any: 'Any Grade Level',
  Adult: 'Adults',
  Elementary: 'Elementary Students',
}

type DiscoverFeedProps = {
  initialCurricula: Curriculum[]
  initialTotal: number
  overrides?: Record<string, CurriculumOverride>
}

export function DiscoverFeed({
  initialCurricula,
  initialTotal,
  overrides,
}: DiscoverFeedProps) {
  const [curricula, setCurricula] = useState(initialCurricula)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOption>('newest')
  const [isPending, startTransition] = useTransition()

  const hasMore = curricula.length < total

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>()
    for (const c of curricula) {
      if (c.grade_level) grades.add(c.grade_level)
    }
    return Array.from(grades).sort()
  }, [curricula])

  const filtered = useMemo(() => {
    let result = curricula

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          (c.public_title ?? c.name).toLowerCase().includes(q) ||
          (c.public_description ?? '').toLowerCase().includes(q) ||
          (c.publisher_name ?? '').toLowerCase().includes(q),
      )
    }

    if (gradeFilter) {
      result = result.filter((c) => c.grade_level === gradeFilter)
    }

    return [...result].sort((a, b) => {
      switch (sortOrder) {
        case 'newest':
          return (
            new Date(b.published_at ?? 0).getTime() -
            new Date(a.published_at ?? 0).getTime()
          )
        case 'oldest':
          return (
            new Date(a.published_at ?? 0).getTime() -
            new Date(b.published_at ?? 0).getTime()
          )
        case 'az':
          return (a.public_title ?? a.name).localeCompare(
            b.public_title ?? b.name,
            undefined,
            { sensitivity: 'base' },
          )
        case 'za':
          return (b.public_title ?? b.name).localeCompare(
            a.public_title ?? a.name,
            undefined,
            { sensitivity: 'base' },
          )
        default:
          return 0
      }
    })
  }, [curricula, search, gradeFilter, sortOrder])

  const hasActiveFilters = search.trim() !== '' || gradeFilter !== ''

  function clearFilters() {
    setSearch('')
    setGradeFilter('')
  }

  function handleLoadMore() {
    const nextPage = page + 1
    startTransition(async () => {
      const result = await loadMoreCurricula(nextPage)
      setCurricula((prev) => [...prev, ...result.curricula])
      setTotal(result.total)
      setPage(nextPage)
    })
  }

  return (
    <>
      {curricula.length > 0 && (
        <div className="discover-filters">
          <input
            type="search"
            placeholder="Filter curriculums by keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter curriculums"
          />
          {gradeOptions.length > 0 && (
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              aria-label="Filter by grade"
            >
              <option value="">All Grades</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          )}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOption)}
            aria-label="Sort curriculums"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {curricula.length === 0 ? (
        <EmptyState />
      ) : filtered.length > 0 ? (
        <section className="discover-grid" aria-label="Curriculums">
          {filtered.map((c) => (
            <CurriculumCard key={c.id} curriculum={c} override={overrides?.[c.id]} />
          ))}
        </section>
      ) : (
        <article className="discover-empty">
          <p>No curriculums match your filters.</p>
          <button type="button" className="outline" onClick={clearFilters}>
            Clear filters
          </button>
        </article>
      )}

      {!hasActiveFilters && hasMore && (
        <p className="discover-loadmore">
          <button type="button" className="outline" onClick={handleLoadMore} disabled={isPending}>
            {isPending ? 'Loading…' : 'Load more'}
          </button>
        </p>
      )}
    </>
  )
}

function CurriculumCard({
  curriculum,
  override,
}: {
  curriculum: Curriculum
  override?: CurriculumOverride
}) {
  const title = override?.title ?? curriculum.public_title ?? curriculum.name
  const href = override?.slug ? `/discover/${override.slug}` : `/discover/${curriculum.id}`
  const backgroundImage = override?.backgroundImage
  const taskCount = curriculum.tasks?.[0]?.count ?? 0
  const description = curriculum.public_description
    ? `${taskCount > 0 ? `${taskCount.toLocaleString()} tasks. ` : ''}${curriculum.public_description}`
    : taskCount > 0
      ? `${taskCount.toLocaleString()} tasks`
      : null

  return (
    <article className="discover-card">
      <Link href={href}>
        {backgroundImage && (
          <div className="discover-card-image">
            <Image src={backgroundImage} alt="" width={800} height={480} />
          </div>
        )}
        <div className="discover-card-body">
          <header>
            <h3>{title}</h3>
            {curriculum.grade_level && (
              <small><strong>Best for:</strong> {GRADE_LABELS[curriculum.grade_level] ?? curriculum.grade_level}</small>
            )}
          </header>
          <p>{description ?? <em>No description provided.</em>}</p>
        </div>
      </Link>
    </article>
  )
}

function EmptyState() {
  return (
    <article className="discover-empty">
      <p>No curriculums available yet. Check back soon.</p>
    </article>
  )
}
