'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task } from './curriculum-landing'

type JourneyPreviewProps = {
  tasks: Task[]
}

const DESKTOP_PAGE_SIZE = 4
const MOBILE_PAGE_SIZE = 2

function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const touchStart = useRef<number | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStart.current === null) return
      const delta = e.changedTouches[0].clientX - touchStart.current
      touchStart.current = null
      if (Math.abs(delta) < 50) return
      if (delta < 0) onSwipeLeft()
      else onSwipeRight()
    },
    [onSwipeLeft, onSwipeRight],
  )

  return { onTouchStart, onTouchEnd }
}

export function JourneyPreview({ tasks }: JourneyPreviewProps) {
  const [startIndex, setStartIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DESKTOP_PAGE_SIZE)

  // Pick page size from viewport once on mount + on resize.
  useEffect(() => {
    function update() {
      setPageSize(window.innerWidth >= 768 ? DESKTOP_PAGE_SIZE : MOBILE_PAGE_SIZE)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const totalTasks = tasks.length
  const maxStart = Math.max(0, totalTasks - pageSize)
  const safeStart = Math.min(startIndex, maxStart)

  const prev = useCallback(() => setStartIndex((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setStartIndex((i) => Math.min(maxStart, i + 1)), [maxStart])
  const swipe = useSwipe(next, prev)

  if (totalTasks === 0) return null

  const slice = tasks.slice(safeStart, safeStart + pageSize)
  const canPrev = safeStart > 0
  const canNext = safeStart < maxStart
  const rangeStart = safeStart + 1
  const rangeEnd = Math.min(safeStart + pageSize, totalTasks)
  const progress = totalTasks <= pageSize ? 100 : (safeStart / maxStart) * 100

  return (
    <section className="journey-preview">
      <hgroup>
        <h2>Here&apos;s what the path actually looks like</h2>
        <p>Preview the sequence. Step through the journey.</p>
      </hgroup>

      <article className="journey-browser">
        <div
          className="journey-grid"
          onTouchStart={swipe.onTouchStart}
          onTouchEnd={swipe.onTouchEnd}
        >
          {slice.map((task, i) => (
            <TaskCard key={task.id} task={task} number={safeStart + i + 1} />
          ))}
        </div>

        <div className="journey-nav">
          <div className="journey-nav-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="journey-nav-controls">
            <button
              type="button"
              onClick={prev}
              disabled={!canPrev}
              aria-label="Previous tasks"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {rangeStart}–{rangeEnd} of {totalTasks.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={next}
              disabled={!canNext}
              aria-label="Next tasks"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </article>
    </section>
  )
}

function TaskCard({ task, number }: { task: Task; number: number }) {
  return (
    <div className="journey-card">
      <div className="step-row">
        <span className="step-num">{number}</span>
        <span>{task.action_type}</span>
      </div>
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
    </div>
  )
}
