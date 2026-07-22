import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function RequestSentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: curriculum } = await db.getCurriculumById(id)
  if (!curriculum) {
    notFound()
  }

  return (
    <article className="confirmation-card">
      <div className="confirmation-icon" aria-hidden>📨</div>
      <hgroup>
        <h1>Request sent!</h1>
        <p>
          Your enrollment request for <strong>{curriculum.name}</strong> has been sent to your Guide. You will be enrolled once they approve it.
        </p>
      </hgroup>
      <div className="confirmation-actions">
        <Link href="/curriculums" role="button">Back to curriculums</Link>
      </div>
    </article>
  )
}
