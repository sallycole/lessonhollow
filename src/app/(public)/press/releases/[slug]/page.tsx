import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getReleaseBySlug, getAllReleases } from '@/lib/press'
import { MarkdownContent } from '@/components/markdown-content'
import { SITE_URL, SITE_NAME } from '@/lib/seo'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const release = getReleaseBySlug(slug)

  if (!release || !release.published) {
    return { title: 'Not Found — Lesson Hollow' }
  }

  const description =
    release.excerpt || `${release.title} — a press release from Lesson Hollow.`
  const canonicalUrl = `${SITE_URL}/press/releases/${slug}`

  return {
    title: `${release.title} — Lesson Hollow Press`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: release.title,
      description,
      type: 'article',
      siteName: SITE_NAME,
      url: canonicalUrl,
      publishedTime: release.date,
    },
    twitter: {
      card: 'summary',
      title: release.title,
      description,
    },
  }
}

export default async function PressReleasePage({ params }: Props) {
  const { slug } = await params
  const release = getReleaseBySlug(slug)

  if (!release || !release.published) {
    notFound()
  }

  return (
    <article className="press-release">
      <header>
        <h1>{release.title}</h1>
        <p className="press-meta">
          <time dateTime={release.date}>
            {new Date(release.date + 'T00:00:00').toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        </p>
      </header>

      <MarkdownContent content={release.content} />

      <nav className="press-nav" aria-label="Press navigation">
        <Link href="/press" role="button" className="outline">
          Back to Press Room
        </Link>
      </nav>
    </article>
  )
}

export function generateStaticParams() {
  const releases = getAllReleases()
  return releases.map((release) => ({
    slug: release.slug,
  }))
}
