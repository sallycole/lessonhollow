'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardCopy, Check, Loader2 } from 'lucide-react'
import { getTasksForDotAction, type DotTaskDetail } from './dot-plot-actions'
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  daysBetweenKeys,
  todayInTimeZone,
} from '@/lib/date-tz'

interface DotPlotProps {
  completionDates: string[]
  completionStatuses?: string[]
  startDate: string
  enrollmentId?: string
  timeZone: string
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(minutes: number): string {
  if (minutes === 0) return ''
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

const DRAG_THRESHOLD = 5

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

export function DotPlot({
  completionDates,
  completionStatuses,
  startDate,
  enrollmentId,
  timeZone,
}: DotPlotProps) {
  const [offset, setOffset] = useState(0)
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null)
  const didDragRef = useRef(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState<string>('')
  const [modalTasks, setModalTasks] = useState<DotTaskDetail[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const dialogRef = useNativeDialog(modalOpen, () => setModalOpen(false))

  // Bucket completions by calendar day in the player's time zone (not UTC),
  // so an evening-local completion lands on the right dot.
  const dotsMap = new Map<string, string[]>()
  for (let i = 0; i < completionDates.length; i++) {
    const key = dateKeyInTimeZone(completionDates[i], timeZone)
    const status = completionStatuses?.[i] ?? 'completed'
    const list = dotsMap.get(key) ?? []
    list.push(status)
    dotsMap.set(key, list)
  }
  const countsMap = new Map<string, number>()
  for (const [key, statuses] of dotsMap) countsMap.set(key, statuses.length)

  const globalMax = Math.max(1, ...countsMap.values())

  const todayKey = todayInTimeZone(timeZone)
  const startKey = startDate.split('T')[0]
  const daysSinceStart = Math.max(0, daysBetweenKeys(startKey, todayKey))
  const maxOffset = Math.max(0, daysSinceStart - 6)

  const days: { date: Date; key: string; count: number; statuses: string[] }[] = []
  for (let i = 6; i >= 0; i--) {
    const key = addDaysToDateKey(todayKey, -(i + offset))
    days.push({
      date: new Date(key + 'T00:00:00'),
      key,
      count: countsMap.get(key) ?? 0,
      statuses: dotsMap.get(key) ?? [],
    })
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { startX: e.clientX, startOffset: offset }
      didDragRef.current = false
    },
    [offset],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      if (Math.abs(dx) > DRAG_THRESHOLD) didDragRef.current = true
      const step = Math.round(dx / 30)
      const newOffset = Math.max(0, Math.min(maxOffset, dragRef.current.startOffset + step))
      setOffset(newOffset)
    },
    [maxOffset],
  )

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const modalDateObj = modalDate ? new Date(modalDate + 'T00:00:00') : null

  const handleDotClick = useCallback(
    async (dateKey: string) => {
      if (didDragRef.current || !enrollmentId) return
      setModalDate(dateKey)
      setModalLoading(true)
      setModalOpen(true)
      setCopied(false)
      const result = await getTasksForDotAction(enrollmentId, dateKey)
      setModalTasks(result.tasks)
      setModalLoading(false)
    },
    [enrollmentId],
  )

  const handleCopy = useCallback(async () => {
    const lines: string[] = []
    if (modalDateObj) {
      lines.push(formatLongDate(modalDateObj))
      lines.push('')
    }
    for (const t of modalTasks) {
      const taskLines: string[] = [
        `${t.title}${t.status === 'skipped' ? ' (Skipped)' : ''}`,
      ]
      if (t.description) taskLines.push(`  ${t.description}`)
      if (t.actionType) taskLines.push(`  Type: ${t.actionType}`)
      if (t.timeMinutes > 0) taskLines.push(`  Time: ${formatTime(t.timeMinutes)}`)
      if (t.resourceUrl) taskLines.push(`  Resource: ${t.resourceUrl}`)
      if (t.notes) taskLines.push(`  Notes: ${t.notes}`)
      if (t.completedAt) {
        const time = new Date(t.completedAt).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
        taskLines.push(`  Completed: ${time}`)
      }
      lines.push(taskLines.join('\n'))
    }
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [modalTasks, modalDateObj])

  const isClickable = !!enrollmentId

  return (
    <>
      <div
        className="dot-plot"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="dot-plot-row">
          <div className="dot-plot-axis">
            <span>Completed Tasks</span>
          </div>
          <div className="dot-plot-cols" style={{ minHeight: globalMax * 14 }}>
            {days.map((day) => (
              <div
                key={day.key}
                className="dot-plot-col"
                style={{ minHeight: globalMax * 14 }}
              >
                {[...day.statuses].reverse().map((status, i) => (
                  <span
                    key={i}
                    className={`dot-plot-dot${status === 'skipped' ? ' skipped' : ''}${isClickable ? ' clickable' : ''}`}
                    onPointerUp={(e) => {
                      if (!didDragRef.current && isClickable) {
                        e.stopPropagation()
                        handleDotClick(day.key)
                      }
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="dot-plot-labels">
          {days.map((day) => {
            const isToday = day.key === todayKey
            return (
              <span key={day.key}>
                {isToday
                  ? 'Today'
                  : day.date.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
            )
          })}
        </div>
      </div>

      <dialog ref={dialogRef} className="dot-plot-dialog">
        <article>
          <header>
            <h3>{modalDateObj ? formatLongDate(modalDateObj) : 'Tasks'}</h3>
          </header>
          {modalLoading ? (
            <p style={{ textAlign: 'center', padding: '2rem 0' }}>
              <Loader2 size={20} />
            </p>
          ) : modalTasks.length === 0 ? (
            <p>No tasks found for this date.</p>
          ) : (
            <>
              <ul className="dot-task-list">
                {modalTasks.map((task, i) => (
                  <li key={i}>
                    <div className="dot-task-head">
                      <strong>{task.title}</strong>
                      <span>
                        {task.actionType && (
                          <span className="action-badge">{task.actionType}</span>
                        )}{' '}
                        {task.status === 'skipped' && (
                          <span className="action-badge skipped">Skipped</span>
                        )}
                      </span>
                    </div>
                    {task.description && (
                      <p>
                        <small>{task.description}</small>
                      </p>
                    )}
                    <p className="dot-task-meta">
                      {task.timeMinutes > 0 && <span>{formatTime(task.timeMinutes)}</span>}
                      {task.completedAt && (
                        <span>
                          {new Date(task.completedAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </p>
                    {task.resourceUrl && (
                      <p>
                        <a
                          href={task.resourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {task.resourceUrl}
                        </a>
                      </p>
                    )}
                    {task.notes && (
                      <p>
                        <em>
                          <small>{task.notes}</small>
                        </em>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="copy-row">
                <button
                  type="button"
                  className="outline"
                  onClick={handleCopy}
                  disabled={modalTasks.length === 0}
                >
                  {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}{' '}
                  {copied ? 'Copied' : 'Copy to Clipboard'}
                </button>
              </div>
            </>
          )}
          <footer>
            <button type="button" className="secondary" onClick={() => setModalOpen(false)}>
              Close
            </button>
          </footer>
        </article>
      </dialog>
    </>
  )
}
