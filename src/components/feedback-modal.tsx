'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { submitFeedback } from '@/lib/feedback-actions'

const FEEDBACK_TYPES = ['Bug', 'Feature', 'Use Case', 'General'] as const

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

export function FeedbackButton({ asMenuItem, asLink }: { asMenuItem?: boolean; asLink?: boolean } = {}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [feedbackType, setFeedbackType] = useState<string>('General')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const dialogRef = useNativeDialog(open, () => setOpen(false))

  function resetForm() {
    setFeedbackType('General')
    setTitle('')
    setDetails('')
    setError(null)
    setSuccess(false)
  }

  function handleOpen() {
    resetForm()
    setOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await submitFeedback({
        feedback_type: feedbackType,
        title,
        details: details || undefined,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => setOpen(false), 2000)
      }
    })
  }

  const triggerClass = asLink
    ? 'feedback-trigger-link'
    : asMenuItem
      ? 'feedback-trigger-menuitem'
      : 'outline feedback-trigger-button'

  return (
    <>
      <button type="button" className={triggerClass} onClick={handleOpen}>
        Feedback
      </button>

      <dialog ref={dialogRef} className="feedback-dialog">
        <article>
          {success ? (
            <div className="feedback-success">
              <p><strong>Thank you for your feedback!</strong></p>
              <p>We appreciate you taking the time to help improve Lesson Hollow.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <header>
                <h3>Send Feedback</h3>
                <p>Let us know how we can improve Lesson Hollow.</p>
              </header>

              <label htmlFor="feedback-type">
                Type
                <select
                  id="feedback-type"
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value)}
                >
                  {FEEDBACK_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>

              <label htmlFor="feedback-title">
                Title
                <input
                  id="feedback-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of your feedback"
                  required
                  maxLength={200}
                  disabled={isPending}
                />
              </label>

              <label htmlFor="feedback-details">
                Details <small>(optional)</small>
                <textarea
                  id="feedback-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Tell us more..."
                  maxLength={5000}
                  rows={4}
                  disabled={isPending}
                />
              </label>

              {error && (
                <p className="feedback-error" role="alert">{error}</p>
              )}

              <footer>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isPending || !title.trim()} aria-busy={isPending}>
                  {isPending ? 'Sending…' : 'Send Feedback'}
                </button>
              </footer>
            </form>
          )}
        </article>
      </dialog>
    </>
  )
}
