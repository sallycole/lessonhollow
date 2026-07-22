import fs from 'fs'
import path from 'path'
import type { Metadata } from 'next'
import { MarkdownContent } from '@/components/markdown-content'

export const metadata: Metadata = {
  title: 'Privacy Policy — Lesson Hollow',
  description: 'Privacy policy for Lesson Hollow, the curriculum building and progress tracking app for homeschool families, microschools, and self-directed learners.',
  openGraph: {
    title: 'Privacy Policy — Lesson Hollow',
    description: 'Privacy policy for Lesson Hollow.',
    images: [
      {
        url: '/og/lesson-hollow-collage-og.png',
        width: 1200,
        height: 630,
        alt: 'Lesson Hollow Privacy Policy',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy — Lesson Hollow',
    description: 'Privacy policy for Lesson Hollow.',
    images: ['/og/lesson-hollow-collage-og.png'],
  },
}

export default function PrivacyPage() {
  const content = fs.readFileSync(
    path.join(process.cwd(), 'content', 'legal', 'privacy.md'),
    'utf-8',
  )

  return (
    <article className="legal-doc">
      <MarkdownContent content={content} />
    </article>
  )
}
