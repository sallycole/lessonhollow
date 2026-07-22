import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getAllPosts } from '@/lib/blog'
import { BlogIndex } from './blog-index'

export const metadata: Metadata = {
  title: 'Blog — Lesson Hollow',
  description:
    'News, updates, and insights from the Lesson Hollow team about self-directed learning.',
  openGraph: {
    title: 'Blog — Lesson Hollow',
    description:
      'News, updates, and insights from the Lesson Hollow team about self-directed learning.',
    images: [
      {
        url: '/og/lesson-hollow-default-og.png',
        width: 1200,
        height: 630,
        alt: 'Lesson Hollow Blog',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog — Lesson Hollow',
    description:
      'News, updates, and insights from the Lesson Hollow team about self-directed learning.',
    images: ['/og/lesson-hollow-default-og.png'],
  },
}

export default function BlogPage() {
  const posts = getAllPosts()

  return (
    <>
      <hgroup>
        <h1>Blog</h1>
        <p>News, updates, and insights about self-directed learning.</p>
      </hgroup>
      <Suspense>
        <BlogIndex posts={posts} />
      </Suspense>
    </>
  )
}
