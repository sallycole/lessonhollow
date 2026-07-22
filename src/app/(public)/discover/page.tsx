import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { getDiscoverOverrides, getRegisteredCurriculumIds } from '@/content/curricula'
import { DiscoverFeed } from './discover-feed'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Discover Curriculums — Lesson Hollow',
  description:
    'Browse curated learning paths on Lesson Hollow. Find curriculums for any subject.',
  openGraph: {
    title: 'Discover Curriculums — Lesson Hollow',
    description:
      'Browse curated learning paths on Lesson Hollow. Find curriculums for any subject.',
    images: [
      {
        url: '/og/lesson-hollow-default-og.png',
        width: 1200,
        height: 630,
        alt: 'Discover Curriculums on Lesson Hollow',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discover Curriculums — Lesson Hollow',
    description:
      'Browse curated learning paths on Lesson Hollow. Find curriculums for any subject.',
    images: ['/og/lesson-hollow-default-og.png'],
  },
}

export default async function DiscoverPage() {
  let curricula: Awaited<ReturnType<typeof db.getPublicCurricula>>['data'] = []
  let total = 0

  try {
    const result = await db.getPublicCurricula(1, 100, 'recent')
    const registeredIds = getRegisteredCurriculumIds()
    curricula = (result.data ?? []).filter((c: { id: string }) => registeredIds.has(c.id))
    total = curricula.length
  } catch {
    // Supabase not configured — show empty state
  }

  return (
    <>
      <hgroup className="discover-header">
        <h1>Discover Curriculums</h1>
        <p>Browse curated learning paths on Lesson Hollow.</p>
      </hgroup>

      <DiscoverFeed
        initialCurricula={curricula}
        initialTotal={total}
        overrides={Object.fromEntries(getDiscoverOverrides())}
      />
    </>
  )
}
