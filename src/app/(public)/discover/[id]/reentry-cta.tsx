'use client'

import type { CurriculumLanding } from '@/content/curricula/types'
import type { Player } from './curriculum-landing'
import { AdoptCta } from './hero-promise'

type ReentryCtaProps = {
  curriculumId: string
  landing: CurriculumLanding | null
  isAuthenticated?: boolean
  players?: Player[]
}

export function ReentryCta({ curriculumId, landing, isAuthenticated, players }: ReentryCtaProps) {
  const ctaLabel = landing?.ctaLabel ?? 'Make This My First Curriculum'
  const ctaSubtext =
    landing?.ctaSubtext ??
    'We’ll preload this curriculum so your first session starts with the path already in place.'

  return (
    <section className="reentry-cta">
      <hgroup>
        <h2>Ready to make this yours?</h2>
        <p>{ctaSubtext}</p>
      </hgroup>

      <AdoptCta
        curriculumId={curriculumId}
        ctaLabel={ctaLabel}
        ctaSubtext=""
        isAuthenticated={isAuthenticated}
        players={players}
      />

      {!isAuthenticated && (
        <p className="signup-funnel">
          Create account → quick setup → start with task 1
        </p>
      )}
    </section>
  )
}
