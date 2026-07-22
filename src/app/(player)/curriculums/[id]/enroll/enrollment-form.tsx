'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createEnrollmentAction, createEnrollmentRequestAction, type EnrollActionState } from './actions'
import { ENROLLMENT_COST_DISPLAY } from '@/lib/pricing'
import { addDaysToDateKey } from '@/lib/date-tz'

const STUDY_DAYS_OPTIONS = Array.from({ length: 14 }, (_, i) => {
  const value = (i + 1) * 0.5
  return { value: String(value), label: String(value) }
})

const TASKS_PER_DAY_OPTIONS = Array.from({ length: 10 }, (_, i) => {
  const value = i + 1
  return { value: String(value), label: String(value) }
})

const ENROLLMENT_TYPES = [
  {
    value: 'core' as const,
    label: 'Core',
    description: 'Must be completed by a target date. Tasks are worked through in order.',
  },
  {
    value: 'elective' as const,
    label: 'Elective',
    description: 'Optional completion date. Work through tasks at your own pace.',
  },
  {
    value: 'memorization' as const,
    label: 'Memorization',
    description: 'Cycle through tasks multiple times to build retention. Set a target number of loops.',
  },
] as const

function calculateTargetDate(
  taskCount: number,
  studyDaysPerWeek: number,
  tasksPerStudyDay: number,
  targetLoops: number = 1,
  startFrom: string = '',
  todayKey: string = ''
): string {
  if (!studyDaysPerWeek || !tasksPerStudyDay || taskCount === 0) return ''
  const totalWork = taskCount * targetLoops
  const studyDaysNeeded = Math.ceil(totalWork / tasksPerStudyDay)
  const calendarDays = Math.ceil(studyDaysNeeded / (studyDaysPerWeek / 7))
  // Project from the chosen start date, else the player's local today. Pure
  // date-key math so no browser-zone offset shifts the result.
  return addDaysToDateKey(startFrom || todayKey, calendarDays)
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

const initialState: EnrollActionState = {}

export function EnrollmentForm({
  curriculumId,
  taskCount,
  creditBlocked = false,
  isFreeEnrollment = false,
  isMasquerading = false,
  mode = 'enroll',
  todayKey,
}: {
  curriculumId: string
  taskCount: number
  creditBlocked?: boolean
  isFreeEnrollment?: boolean
  isMasquerading?: boolean
  mode?: 'enroll' | 'request'
  todayKey: string
}) {
  const action = mode === 'request' ? createEnrollmentRequestAction : createEnrollmentAction
  const [state, formAction, pending] = useActionState(action, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const confirmedRef = useRef(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('')
  const [manualTargetDate, setManualTargetDate] = useState<string>('')
  const [electiveMode, setElectiveMode] = useState<'ongoing' | 'target'>('ongoing')
  const [targetLoops, setTargetLoops] = useState<string>('')
  const [studyDays, setStudyDays] = useState<string>('')
  const [tasksPerDay, setTasksPerDay] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  // Earliest selectable start date is tomorrow in the player's zone.
  const minDate = useMemo(() => addDaysToDateKey(todayKey, 1), [todayKey])

  const confirmDialogRef = useNativeDialog(showConfirmDialog, () => setShowConfirmDialog(false))

  const needsDate =
    selectedType === 'core' ||
    selectedType === 'memorization' ||
    (selectedType === 'elective' && electiveMode === 'target')
  const autoTargetDate = studyDays && tasksPerDay && taskCount > 0
    ? calculateTargetDate(
        taskCount,
        Number(studyDays),
        Number(tasksPerDay),
        selectedType === 'memorization' && targetLoops ? Number(targetLoops) : 1,
        startDate,
        todayKey,
      )
    : ''
  const dateManuallySet = manualTargetDate !== ''
  const targetDate = dateManuallySet ? manualTargetDate : autoTargetDate

  return (
    <article className="enroll-card">
      <form
        ref={formRef}
        action={formAction}
        onSubmit={
          isMasquerading
            ? (e) => {
                if (!confirmedRef.current) {
                  e.preventDefault()
                  setShowConfirmDialog(true)
                }
                confirmedRef.current = false
              }
            : undefined
        }
      >
        <input type="hidden" name="curriculum_id" value={curriculumId} />

        <fieldset className="radio-card-group">
          <legend>
            Enrollment Type <span className="required-marker">*</span>
          </legend>
          {ENROLLMENT_TYPES.map((type) => (
            <label
              key={type.value}
              className="radio-card"
              data-selected={selectedType === type.value}
            >
              <input
                type="radio"
                name="enrollment_type"
                value={type.value}
                checked={selectedType === type.value}
                onChange={() => {
                  setSelectedType(type.value)
                  setManualTargetDate('')
                  if (type.value === 'elective') setElectiveMode('ongoing')
                  if (type.value !== 'memorization') setTargetLoops('')
                }}
              />
              <div className="radio-card-body">
                <strong>{type.label}</strong>
                <p>{type.description}</p>
              </div>
            </label>
          ))}
          {state.fieldErrors?.enrollment_type && (
            <p className="field-error">{state.fieldErrors.enrollment_type[0]}</p>
          )}
        </fieldset>

        {selectedType === 'elective' && (
          <fieldset className="radio-card-group">
            <legend>Completion Timeline</legend>
            <label className="radio-card" data-selected={electiveMode === 'ongoing'}>
              <input
                type="radio"
                name="elective_mode"
                value="ongoing"
                checked={electiveMode === 'ongoing'}
                onChange={() => {
                  setElectiveMode('ongoing')
                  setManualTargetDate('')
                }}
              />
              <div className="radio-card-body">
                <strong>Ongoing</strong>
                <p>No deadline. Work through tasks at your own pace.</p>
              </div>
            </label>
            <label className="radio-card" data-selected={electiveMode === 'target'}>
              <input
                type="radio"
                name="elective_mode"
                value="target"
                checked={electiveMode === 'target'}
                onChange={() => setElectiveMode('target')}
              />
              <div className="radio-card-body">
                <strong>Set a target date</strong>
                <p>Choose a date you&apos;d like to finish by.</p>
              </div>
            </label>
          </fieldset>
        )}

        {selectedType === 'memorization' && (
          <label htmlFor="target_loops">
            Target Loops <span className="required-marker">*</span>
            <input
              id="target_loops"
              name="target_loops"
              type="number"
              value={targetLoops}
              onChange={(e) => {
                setTargetLoops(e.target.value)
                setManualTargetDate('')
              }}
              min={1}
              step={1}
              required
              placeholder="How many times to cycle through all tasks"
              aria-invalid={!!state.fieldErrors?.target_loops}
            />
            <p>Number of times to cycle through all tasks (minimum 1).</p>
            {state.fieldErrors?.target_loops && (
              <p className="field-error">{state.fieldErrors.target_loops[0]}</p>
            )}
          </label>
        )}

        {selectedType && (
          <>
            <label htmlFor="start_date">
              Start Date
              <input
                id="start_date"
                name="start_date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setManualTargetDate('')
                }}
                aria-invalid={!!state.fieldErrors?.start_date}
              />
              <p>Defaults to today. Set a future date if this enrollment starts later — no tasks will count as behind before then.</p>
              {state.fieldErrors?.start_date && (
                <p className="field-error">{state.fieldErrors.start_date[0]}</p>
              )}
            </label>

            <label htmlFor="study_days_per_week">
              Study Days per Week <span className="required-marker">*</span>
              <input type="hidden" name="study_days_per_week" value={studyDays} />
              <select
                id="study_days_per_week"
                value={studyDays}
                onChange={(e) => {
                  setStudyDays(e.target.value)
                  setManualTargetDate('')
                }}
                aria-invalid={!!state.fieldErrors?.study_days_per_week}
              >
                <option value="" disabled>Select study days</option>
                {STUDY_DAYS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} {Number(opt.value) === 1 ? 'day' : 'days'}
                  </option>
                ))}
              </select>
              <p>How many days per week to study (half-day increments).</p>
              {state.fieldErrors?.study_days_per_week && (
                <p className="field-error">{state.fieldErrors.study_days_per_week[0]}</p>
              )}
            </label>

            <label htmlFor="tasks_per_study_day">
              Tasks per Study Day <span className="required-marker">*</span>
              <input type="hidden" name="tasks_per_study_day" value={tasksPerDay} />
              <select
                id="tasks_per_study_day"
                value={tasksPerDay}
                onChange={(e) => {
                  setTasksPerDay(e.target.value)
                  setManualTargetDate('')
                }}
              >
                <option value="" disabled>Select tasks per day</option>
                {TASKS_PER_DAY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} {Number(opt.value) === 1 ? 'task' : 'tasks'}
                  </option>
                ))}
              </select>
              <p>{taskCount} {taskCount === 1 ? 'task' : 'tasks'} in this curriculum.</p>
            </label>
          </>
        )}

        {needsDate && (
          <label htmlFor="target_completion_date">
            Target Completion Date {selectedType !== 'elective' && <span className="required-marker">*</span>}
            <input
              id="target_completion_date"
              name="target_completion_date"
              type="date"
              value={targetDate}
              onChange={(e) => setManualTargetDate(e.target.value)}
              min={minDate}
              required={selectedType === 'core' || selectedType === 'memorization'}
              aria-invalid={!!state.fieldErrors?.target_completion_date}
            />
            <p>
              {!dateManuallySet && targetDate
                ? 'Auto-calculated from your study pace. You can override this.'
                : 'Must be at least one day in the future.'}
            </p>
            {state.fieldErrors?.target_completion_date && (
              <p className="field-error">{state.fieldErrors.target_completion_date[0]}</p>
            )}
          </label>
        )}

        {state.error && (
          <p className="form-error" role="alert">{state.error}</p>
        )}

        {mode === 'enroll' && isFreeEnrollment && !creditBlocked && (
          <article className="enroll-notice success" role="status">
            <strong>This enrollment is free!</strong>
            <p>This Player&apos;s first enrollment is free — no payment required.</p>
          </article>
        )}

        {mode === 'enroll' && creditBlocked && (
          <article className="enroll-notice danger" role="alert">
            {isMasquerading ? (
              <>
                <p>You&apos;re out of credits. Top up to continue enrolling Players.</p>
                <Link href="/credits" role="button" className="outline">Top Up →</Link>
              </>
            ) : (
              <p>Your Guide needs to add credits before you can start another enrollment. Let them know you&apos;re ready for more!</p>
            )}
          </article>
        )}

        <div className="enroll-submit">
          <button
            type="submit"
            disabled={
              (mode === 'enroll' && creditBlocked) ||
              pending ||
              !selectedType ||
              !studyDays ||
              !tasksPerDay ||
              (selectedType === 'core' && !targetDate) ||
              (selectedType === 'elective' && electiveMode === 'target' && !targetDate) ||
              (selectedType === 'memorization' && (!targetLoops || !targetDate))
            }
            aria-busy={pending}
          >
            {mode === 'request'
              ? (pending ? 'Submitting request…' : 'Request Enrollment')
              : (pending ? 'Enrolling…' : 'Enroll')}
          </button>
        </div>
      </form>

      {isMasquerading && (
        <dialog ref={confirmDialogRef}>
          <article>
            <header>
              <h3>Confirm enrollment</h3>
              <p>
                {isFreeEnrollment
                  ? 'This enrollment is free for this player. No credit will be charged.'
                  : `This will use 1 enrollment credit (${ENROLLMENT_COST_DISPLAY}) from your account.`}
              </p>
            </header>
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmedRef.current = true
                  setShowConfirmDialog(false)
                  formRef.current?.requestSubmit()
                }}
              >
                Confirm Enrollment
              </button>
            </footer>
          </article>
        </dialog>
      )}
    </article>
  )
}
