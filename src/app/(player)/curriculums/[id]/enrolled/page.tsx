import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function EnrolledSuccessPage({
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
      <div className="confirmation-icon" aria-hidden>🎉</div>
      <hgroup>
        <h1>You&apos;re enrolled!</h1>
        <p>
          You just enrolled in <strong>{curriculum.name}</strong>. What would you like to do next?
        </p>
      </hgroup>
      <div className="confirmation-actions">
        <Link href="/plan" role="button">Plan my day</Link>
        <Link href="/enrollments" role="button" className="outline">Manage enrollments</Link>
        <Link href="/curriculums" role="button" className="outline">Manage curriculums</Link>
      </div>
    </article>
  )
}
