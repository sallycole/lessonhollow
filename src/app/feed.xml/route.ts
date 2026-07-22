import { Feed } from 'feed'
import { getAllPosts } from '@/lib/blog'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export async function GET() {
  const posts = getAllPosts()

  const feed = new Feed({
    title: 'Lesson Hollow Blog',
    description:
      'Build your curriculum. Track your progress. Share your path.',
    id: SITE_URL,
    link: SITE_URL,
    language: 'en',
    copyright: `© ${new Date().getFullYear()} Lesson Hollow`,
    feedLinks: {
      rss2: `${SITE_URL}/feed.xml`,
    },
  })

  for (const post of posts) {
    feed.addItem({
      title: post.title,
      id: `${SITE_URL}/blog/${post.slug}`,
      link: `${SITE_URL}/blog/${post.slug}`,
      description: post.excerpt ?? '',
      date: new Date(post.date),
      category: post.categories.map((name) => ({ name })),
    })
  }

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
