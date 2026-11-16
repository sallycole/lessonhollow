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

export const META_DESCRIPTION_MAX_CHARS = 155

const EN_DASH = '\u2013'
const EM_DASH = '\u2014'

/** Replace en/em dashes so meta copy follows the no-dash house style. */
function normalizeMetaDashes(text: string): string {
  return text
    .replace(new RegExp(`(\\d)\\s*${EN_DASH}\\s*(\\d)`, 'g'), '$1 to $2')
    .replace(new RegExp(EN_DASH, 'g'), ' to ')
    .replace(new RegExp(`\\s*${EM_DASH}\\s*`, 'g'), ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Trim a meta description to the search-result budget.
 * Prefers a full sentence, then a clause boundary, then a word boundary,
 * so future Discover landings stay under the limit without hand-editing.
 */
export function trimMetaDescription(
  text: string,
  max = META_DESCRIPTION_MAX_CHARS,
): string {
  const cleaned = normalizeMetaDashes(text)
  if (cleaned.length <= max) return cleaned

  const slice = cleaned.slice(0, max)

  const sentenceEnds: number[] = []
  const sentenceRe = /(?<![A-Z])(?<!\d)[.!?](?=\s+[A-Z]|$)/g
  let match: RegExpExecArray | null
  while ((match = sentenceRe.exec(slice)) !== null) {
    sentenceEnds.push(match.index + 1)
  }
  if (sentenceEnds.length > 0) {
    const end = sentenceEnds[sentenceEnds.length - 1]
    if (end >= 60) {
      return slice.slice(0, end).trim()
    }
  }

  const clauseRe = /[,;](?=\s)/g
  let clauseEnd = -1
  while ((match = clauseRe.exec(slice)) !== null) {
    clauseEnd = match.index
  }
  if (clauseEnd >= 60) {
    return `${slice.slice(0, clauseEnd).trim()}.`
  }

  const wordBreak = slice.search(/\s+\S*$/)
  if (wordBreak >= 1) {
    return slice.slice(0, wordBreak).replace(/[,;:]+$/, '').trim()
  }

  return slice.trim()
}
