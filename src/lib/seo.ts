import type { Metadata } from 'next'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lessonhollow.com'
export const SITE_NAME = 'Lesson Hollow'

export type SeoMetadataOptions = {
  title: string
  description: string
  path: string
  ogType?: 'website' | 'article'
  ogImage?: string
  ogImageAlt?: string
  publishedTime?: string
  socialTitle?: string
  socialDescription?: string
  noIndex?: boolean
}

export function createSeoMetadata(options: SeoMetadataOptions): Metadata {
  const {
    title,
    description,
    path,
    ogType = 'website',
    ogImage = '/og/lesson-hollow-collage-og.png',
    ogImageAlt,
    publishedTime,
    socialTitle,
    socialDescription,
    noIndex = false,
  } = options

  const canonicalUrl = `${SITE_URL}${path}`
  const effectiveSocialTitle = socialTitle || title
  const effectiveSocialDescription = socialDescription || description

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: effectiveSocialTitle,
      description: effectiveSocialDescription,
      type: ogType,
      siteName: SITE_NAME,
      url: canonicalUrl,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: ogImageAlt || title,
        },
      ],
      ...(publishedTime && { publishedTime }),
    },
    twitter: {
      card: 'summary_large_image',
      title: effectiveSocialTitle,
      description: effectiveSocialDescription,
      images: [ogImage],
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  }
}
