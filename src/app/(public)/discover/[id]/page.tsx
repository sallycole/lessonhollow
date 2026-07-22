import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getLandingContent, getRegisteredCurriculumIds } from '@/content/curricula'
import { getEffectiveUser } from '@/lib/masquerade'
import { createClient } from '@/lib/supabase/server'
import { CurriculumLanding } from './curriculum-landing'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

function resolveId(idOrSlug: string): string {
  const landing = getLandingContent(idOrSlug)
  return landing?.curriculumId ?? idOrSlug
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: rawId } = await params
  const id = resolveId(rawId)

  try {
    const { curriculum: { data: curriculum } } = await db.getPublicCurriculumWithTasks(id)
    if (!curriculum) {
      return { title: 'Not Found | Lesson Hollow' }
    }

    const landing = getLandingContent(id)
    const title = landing?.hero.headline ?? curriculum.public_title ?? curriculum.name
    const taskCount = (curriculum.tasks as { count: number }[])?.[0]?.count ?? 0
    const description =
      landing?.hero.subhead ??
      curriculum.public_description ??
      `A learning path with ${taskCount} tasks on Lesson Hollow`

    const fullTitle = `${title} | Lesson Hollow`
    const socialTitle = landing?.ogTitle ?? title
    const socialDescription = landing?.ogDescription ?? description
    const ogImages = landing?.ogImage
      ? [{ url: landing.ogImage, width: 1200, height: 630, alt: title }]
      : undefined

    return {
      title: fullTitle,
      description,
      openGraph: {
        title: socialTitle,
        description: socialDescription,
        type: 'article',
        siteName: 'Lesson Hollow',
        ...(ogImages && { images: ogImages }),
      },
      ...(landing?.ogImage && {
        twitter: {
          card: 'summary_large_image' as const,
          title: socialTitle,
          description: socialDescription,
          images: [landing.ogImage],
        },
      }),
    }
  } catch {
    return { title: 'Discover | Lesson Hollow' }
  }
}

export default async function DiscoverDetailPage({ params }: Props) {
  const { id: rawId } = await params
  const id = resolveId(rawId)

  // Only registered curricula get a discover detail page. Public-but-
  // unregistered curricula 404 here so we never render a promo page
  // without promo content.
  if (!getRegisteredCurriculumIds().has(id)) notFound()

  let curriculum: Record<string, unknown>
  let tasks: Array<{
    id: string
    title: string
    description: string | null
    action_type: string
    resource_url: string | null
    position: number
  }>

  try {
    const result = await db.getPublicCurriculumWithTasks(id)
    if (result.curriculum.error || !result.curriculum.data) notFound()
    if (result.tasks.error) notFound()
    curriculum = result.curriculum.data as Record<string, unknown>
    tasks = (result.tasks.data ?? []) as typeof tasks
  } catch {
    notFound()
  }

  const landing = getLandingContent(id)
  const effectiveUser = await getEffectiveUser()
  const isAuthenticated = !!effectiveUser

  // Fetch player list for authenticated guides
  let players: { id: string; first_name: string }[] = []
  if (isAuthenticated) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.user_metadata?.role === 'guide') {
      const { data } = await db.getPlayersByGuide(user.id)
      players = (data ?? []).map((p: { id: string; first_name: string }) => ({
        id: p.id,
        first_name: p.first_name,
      }))
    }
  }

  return (
    <CurriculumLanding
      isAuthenticated={isAuthenticated}
      players={players}
      curriculum={{
        id: curriculum.id as string,
        public_title: curriculum.public_title as string | null,
        name: curriculum.name as string,
        public_description: curriculum.public_description as string | null,
        publisher_name: curriculum.publisher_name as string | null,
        published_at: curriculum.published_at as string | null,
        grade_level: curriculum.grade_level as string | null,
      }}
      tasks={tasks}
      landing={landing}
    />
  )
}
