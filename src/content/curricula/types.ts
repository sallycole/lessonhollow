import type { ReactNode } from 'react'

export type CurriculumLanding = {
  curriculumId: string
  slug: string
  hero: {
    headline: string
    subhead: string
    backgroundImage?: string
  }
  stats?: { label: ReactNode; value: ReactNode }[]
  proofItems?: ReactNode[]
  proofQuote?: { text: string; attribution?: string }
  desireBridge?: {
    heading: string
    paragraph?: string
    benefits?: { title: string; description: string }[]
  }
  ctaLabel?: string
  ctaSubtext?: string
  reentryHint?: string
  footerReassurance?: string
  ogImage?: string
  ogTitle?: string
  ogDescription?: string
}
