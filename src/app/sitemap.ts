import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'
import { getAllReleases } from '@/lib/press'
import { getLandingContent, getRegisteredCurriculumIds } from '@/content/curricula'
import { getPublicHelpPagePaths } from '@/lib/help-pages'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lessonhollow.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/blog`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/discover`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/press`, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const posts = getAllPosts()
  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  const registeredIds = getRegisteredCurriculumIds()
  const discoverRoutes: MetadataRoute.Sitemap = Array.from(registeredIds)
    .map((id) => {
      const landing = getLandingContent(id)
      if (!landing) return null
      return {
        url: `${SITE_URL}/discover/${landing.slug}`,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }
    })
    .filter((route): route is NonNullable<typeof route> => route !== null)

  const helpRoutes: MetadataRoute.Sitemap = getPublicHelpPagePaths().map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  const pressReleases = getAllReleases()
  const pressRoutes: MetadataRoute.Sitemap = pressReleases.map((release) => ({
    url: `${SITE_URL}/press/releases/${release.slug}`,
    lastModified: new Date(release.date),
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  }))

  return [...staticRoutes, ...blogRoutes, ...discoverRoutes, ...helpRoutes, ...pressRoutes]
}
