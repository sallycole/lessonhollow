'use client'

import type { CurriculumLanding as CurriculumLandingContent } from '@/content/curricula/types'
import { HeroPromise } from './hero-promise'
import { JourneyPreview } from './journey-preview'
import { DesireBridge } from './desire-bridge'
import { CredibilityBand } from './credibility-band'
import { ReentryCta } from './reentry-cta'
import { FooterContext } from './footer-context'

export type Task = {
  id: string
  title: string
  description: string | null
  action_type: string
  resource_url: string | null
  position: number
}

type CurriculumData = {
  id: string
  public_title: string | null
  name: string
  public_description: string | null
  publisher_name: string | null
  published_at: string | null
  grade_level: string | null
}

export type Player = {
  id: string
  first_name: string
}

type CurriculumLandingProps = {
  curriculum: CurriculumData
  tasks: Task[]
  landing: CurriculumLandingContent | null
  isAuthenticated?: boolean
  players?: Player[]
}

export function CurriculumLanding({
  curriculum,
  tasks,
  landing,
  isAuthenticated,
  players,
}: CurriculumLandingProps) {
  return (
    <>
      <HeroPromise
        curriculum={curriculum}
        tasks={tasks}
        landing={landing}
        isAuthenticated={isAuthenticated}
        players={players}
      />
      <JourneyPreview tasks={tasks} />
      <DesireBridge landing={landing} />
      <CredibilityBand landing={landing} />
      <ReentryCta
        curriculumId={curriculum.id}
        landing={landing}
        isAuthenticated={isAuthenticated}
        players={players}
      />
      <FooterContext landing={landing} />
    </>
  )
}
