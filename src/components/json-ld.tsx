import { SITE_URL, SITE_NAME } from '@/lib/seo'

type JsonLdProps = {
  data: Record<string, unknown>
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/og/lesson-hollow-collage-og.png`,
    description:
      'Lesson Hollow is a curriculum-building and progress-tracking app for homeschool families, microschool guides, and self-directed learners.',
  }
  return <JsonLd data={data} />
}

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
  }
  return <JsonLd data={data} />
}

type SoftwareApplicationJsonLdProps = {
  name?: string
  description?: string
  price?: string
  priceCurrency?: string
}

export function SoftwareApplicationJsonLd({
  name = SITE_NAME,
  description = 'A curriculum-building and progress-tracking app for homeschool families, microschool guides, and self-directed learners.',
  price = '0.50',
  priceCurrency = 'USD',
}: SoftwareApplicationJsonLdProps = {}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    url: SITE_URL,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency,
      description: 'Per enrollment after first free enrollment',
    },
  }
  return <JsonLd data={data} />
}

type BlogPostingJsonLdProps = {
  headline: string
  datePublished: string
  author?: string
  image?: string
  url: string
  description?: string
}

export function BlogPostingJsonLd({
  headline,
  datePublished,
  author,
  image,
  url,
  description,
}: BlogPostingJsonLdProps) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline,
    datePublished,
    url,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }

  if (author) {
    data.author = {
      '@type': 'Person',
      name: author,
    }
  }

  if (image) {
    data.image = image.startsWith('http') ? image : `${SITE_URL}${image}`
  }

  if (description) {
    data.description = description
  }

  return <JsonLd data={data} />
}

type CourseJsonLdProps = {
  name: string
  description: string
  url: string
  provider?: string
}

export function CourseJsonLd({
  name,
  description,
  url,
  provider = SITE_NAME,
}: CourseJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name,
    description,
    url,
    provider: {
      '@type': 'Organization',
      name: provider,
      url: SITE_URL,
    },
  }
  return <JsonLd data={data} />
}
