import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { EnrollmentForm } from './enrollment-form'
import { getEffectiveUser, resolvePlayerContext } from '@/lib/masquerade'
import { assertEnrollmentCredit } from '@/lib/credits'
import { resolveTimeZone, todayInTimeZone } from '@/lib/date-tz'

export const dynamic = 'force-dynamic'

export default async function EnrollPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: curriculum, error } = await db.getCurriculumById(id)
  if (error || !curriculum) {
    notFound()
  }

  const { data: tasks } = await db.getTasksByCurriculum(id)
  const taskCount = tasks?.length ?? 0

  const effectiveUser = await getEffectiveUser()
  const isMasquerading = effectiveUser?.isMasquerading ?? false
  const mode = isMasquerading ? 'enroll' as const : 'request' as const

  // The player's local "today", used for the start-date picker and projected
  // completion estimate, so they don't shift a day on the UTC server.
  const enrollPlayerId = isMasquerading
    ? effectiveUser?.playerId ?? null
    : effectiveUser
      ? await resolvePlayerContext(effectiveUser)
      : null
  const { data: enrollPlayer } = enrollPlayerId
    ? await db.getPlayerById(enrollPlayerId)
    : { data: null }
  const todayKey = todayInTimeZone(resolveTimeZone(enrollPlayer?.time_zone ?? null))

  if (effectiveUser && !isMasquerading) {
    const playerId = await resolvePlayerContext(effectiveUser)
    if (playerId) {
      const { data: latestRequest } = await db.getLatestRequestByPlayerAndCurriculum(playerId, id)

      if (latestRequest?.status === 'pending') {
        return (
          <div className="enroll-shell">
            <hgroup className="enroll-header">
              <h1>Enroll</h1>
              <p>&ldquo;{curriculum.name}&rdquo;</p>
            </hgroup>
            <article className="enroll-card">
              <hgroup>
                <h3>Enrollment requested</h3>
                <p>
                  Your enrollment request for this curriculum has been sent to your Guide. You will be enrolled once they approve it.
                </p>
              </hgroup>
              <Link href="/curriculums" role="button" className="outline">
                Back to curriculums
              </Link>
            </article>
          </div>
        )
      }

      if (latestRequest?.status === 'denied') {
        return (
          <div className="enroll-shell">
            <hgroup className="enroll-header">
              <h1>Enroll</h1>
              <p>Choose how to study &ldquo;{curriculum.name}&rdquo;.</p>
            </hgroup>
            <article className="enroll-notice warning" role="status">
              <strong>Your previous request was not approved</strong>
              {latestRequest.guide_response && <p>{latestRequest.guide_response}</p>}
              <p>You can submit a new request below.</p>
            </article>
            <EnrollmentForm curriculumId={id} taskCount={taskCount} mode="request" todayKey={todayKey} />
          </div>
        )
      }
    }
  }

  let creditBlocked = false
  let isFreeEnrollment = false
  if (effectiveUser && mode === 'enroll') {
    const guideId = effectiveUser.guideUserId ?? effectiveUser.userId
    const playerId = await resolvePlayerContext(effectiveUser)
    const result = await assertEnrollmentCredit(guideId, playerId)
    creditBlocked = !result.allowed
    if (result.allowed) {
      isFreeEnrollment = result.isFreeEnrollment
    }
  }

  return (
    <div className="enroll-shell">
      <hgroup className="enroll-header">
        <h1>Enroll</h1>
        <p>Choose how to study &ldquo;{curriculum.name}&rdquo;.</p>
      </hgroup>
      <EnrollmentForm
        curriculumId={id}
        taskCount={taskCount}
        creditBlocked={creditBlocked}
        isFreeEnrollment={isFreeEnrollment}
        isMasquerading={isMasquerading}
        mode={mode}
        todayKey={todayKey}
      />
    </div>
  )
}
