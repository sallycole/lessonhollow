import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { getAllCoverage, getAllReleases } from '@/lib/press'
import { SITE_URL, SITE_NAME } from '@/lib/seo'

const PRESS_URL = `${SITE_URL}/press`

export const metadata: Metadata = {
  title: 'Press Room — Lesson Hollow',
  description:
    'Media coverage and press releases from Lesson Hollow, the curriculum building and progress tracking app for homeschool families.',
  alternates: {
    canonical: PRESS_URL,
  },
  openGraph: {
    title: 'Press Room — Lesson Hollow',
    description:
      'Media coverage and press releases from Lesson Hollow.',
    type: 'website',
    siteName: SITE_NAME,
    url: PRESS_URL,
    images: [
      {
        url: '/og/lesson-hollow-collage-og.png',
        width: 1200,
        height: 630,
        alt: 'Lesson Hollow Press Room',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Press Room — Lesson Hollow',
    description:
      'Media coverage and press releases from Lesson Hollow.',
    images: ['/og/lesson-hollow-collage-og.png'],
  },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function PressPage() {
  const coverage = getAllCoverage()
  const releases = getAllReleases()

  return (
    <>
      <hgroup>
        <h1>Press Room</h1>
        <p>Media coverage and announcements from Lesson Hollow.</p>
      </hgroup>

      <section className="press-section">
        <h2>Media Coverage</h2>
        {coverage.length > 0 ? (
          <ul className="press-coverage-list">
            {coverage.map((item) => (
              <li key={item.id} className="press-coverage-item">
                <article>
                  <hgroup>
                    <h3>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.title}
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    </h3>
                    <p className="press-meta">
                      {item.publisherUrl ? (
                        <a
                          href={item.publisherUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.publisher}
                        </a>
                      ) : (
                        <span>{item.publisher}</span>
                      )}
                      {item.date && (
                        <>
                          {' · '}
                          <time dateTime={item.date}>{formatDate(item.date)}</time>
                        </>
                      )}
                      {!item.date && item.dateNote && (
                        <>
                          {' · '}
                          <span>{item.dateNote}</span>
                        </>
                      )}
                    </p>
                  </hgroup>
                  <p>{item.summary}</p>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <p className="press-empty">No media coverage yet.</p>
        )}
      </section>

      <section className="press-section">
        <h2>Press Releases</h2>
        {releases.length > 0 ? (
          <ul className="press-releases-list">
            {releases.map((release) => (
              <li key={release.slug} className="press-release-item">
                <article>
                  <hgroup>
                    <h3>
                      <Link href={`/press/releases/${release.slug}`}>
                        {release.title}
                      </Link>
                    </h3>
                    <p className="press-meta">
                      <time dateTime={release.date}>{formatDate(release.date)}</time>
                    </p>
                  </hgroup>
                  {release.excerpt && <p>{release.excerpt}</p>}
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <p className="press-empty">
            No press releases yet. Check back for future announcements.
          </p>
        )}
      </section>
    </>
  )
}
