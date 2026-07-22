'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  approveEnrollmentRequestAction,
  denyEnrollmentRequestAction,
} from '@/app/(dashboard)/dashboard/enrollment-request-actions'
import { ENROLLMENT_COST_CENTS } from '@/lib/pricing'

export interface EnrollmentRequestData {
  id: string
  playerName: string
  curriculumName: string
  enrollmentType: string
  studyDaysPerWeek: number
  tasksPerStudyDay: number
  targetCompletionDate: string | null
  targetLoops: number | null
  isFreeEnrollment: boolean
  createdAt: string
}

function RequestCard({
  request,
  balanceCents,
}: {
  request: EnrollmentRequestData
  balanceCents: number
}) {
  const router = useRouter()
  const [showDenyForm, setShowDenyForm] = useState(false)
  const [denyResponse, setDenyResponse] = useState('')
  const [approving, startApprove] = useTransition()
  const [denying, startDeny] = useTransition()

  const canAfford = request.isFreeEnrollment || balanceCents >= ENROLLMENT_COST_CENTS

  const handleApprove = () => {
    startApprove(async () => {
      const result = await approveEnrollmentRequestAction(request.id)
      if (result.error) {
        toast.error(result.error, {
          action: { label: 'Top up', onClick: () => router.push('/credits') },
        })
      } else {
        toast.success(`${request.playerName} enrolled in ${request.curriculumName}`)
      }
    })
  }

  const handleDeny = () => {
    startDeny(async () => {
      const result = await denyEnrollmentRequestAction(request.id, denyResponse || undefined)
      if (result.error) toast.error(result.error)
      else toast.success('Request denied')
    })
  }

  const typeLabel =
    request.enrollmentType.charAt(0).toUpperCase() + request.enrollmentType.slice(1)
  const daysLabel = `${request.studyDaysPerWeek} day${request.studyDaysPerWeek === 1 ? '' : 's'}/week`
  const tasksLabel = `${request.tasksPerStudyDay} task${request.tasksPerStudyDay === 1 ? '' : 's'}/day`

  const costClass = request.isFreeEnrollment ? 'free' : !canAfford ? 'unaffordable' : ''

  return (
    <div className="request-card">
      <div>
        <p className="request-summary">
          {request.playerName} wants to enroll in{' '}
          <strong>{request.curriculumName}</strong>
        </p>
        <p className="request-meta">
          <span>{typeLabel}</span>
          <span>·</span>
          <span>{daysLabel}</span>
          <span>·</span>
          <span>{tasksLabel}</span>
          {request.enrollmentType === 'memorization' && request.targetLoops && (
            <>
              <span>·</span>
              <span>
                {request.targetLoops} loop{request.targetLoops === 1 ? '' : 's'}
              </span>
            </>
          )}
          {request.targetCompletionDate && (
            <>
              <span>·</span>
              <span>Target: {request.targetCompletionDate}</span>
            </>
          )}
        </p>
        <p className={`request-cost ${costClass}`.trim()}>
          {request.isFreeEnrollment
            ? 'Free enrollment'
            : canAfford
              ? 'Uses 1 credit'
              : `Uses 1 credit — balance ${Math.floor(balanceCents / ENROLLMENT_COST_CENTS)} credits`}
        </p>
      </div>

      {showDenyForm ? (
        <>
          <textarea
            placeholder="Optional message to the Player (they will see this when they revisit the enrollment page)"
            value={denyResponse}
            onChange={(e) => setDenyResponse(e.target.value)}
            rows={2}
          />
          <div className="request-actions">
            <button
              type="button"
              className="outline secondary"
              onClick={() => {
                setShowDenyForm(false)
                setDenyResponse('')
              }}
              disabled={denying}
            >
              Cancel
            </button>
            <button
              type="button"
              className="contrast"
              onClick={handleDeny}
              disabled={denying}
              aria-busy={denying}
            >
              {denying ? 'Denying…' : 'Deny'}
            </button>
          </div>
        </>
      ) : (
        <div className="request-actions">
          <button
            type="button"
            className="outline secondary"
            onClick={() => setShowDenyForm(true)}
            disabled={approving}
          >
            Deny
          </button>
          {canAfford ? (
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              aria-busy={approving}
            >
              {approving ? 'Approving…' : 'Approve'}
            </button>
          ) : (
            <Link href="/credits" role="button">
              Top up to approve
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export function EnrollmentRequestsSection({
  requests,
  balanceCents,
}: {
  requests: EnrollmentRequestData[]
  balanceCents: number
}) {
  if (requests.length === 0) return null

  return (
    <section className="enrollment-requests" aria-label="Pending enrollment requests">
      <article>
        <h2>
          Enrollment Requests
          <span className="request-count">{requests.length}</span>
        </h2>
        {requests.map((request) => (
          <RequestCard key={request.id} request={request} balanceCents={balanceCents} />
        ))}
      </article>
    </section>
  )
}
