import type { CurriculumLanding } from './types'
import { greatAmericans37 } from './great-americans-3-7'
import { augmentedRealityQuestsMetaQuest3 } from './augmented-reality-quests-meta-quest-3'
import { introductionToPersonalCurriculum } from './introduction-to-personal-curriculum'
import { iainBanksGalacticCivilizationStarterPack } from './iain-banks-galactic-civilization-starter-pack'
import { fiftyTwoLibraryVisitsIn52Weeks } from './52-library-visits-in-52-weeks'
import { computerSkillsForKids } from './computer-skills-for-kids'
import { standardAlgorithms } from './standard-algorithms'

export type { CurriculumLanding }

const registry: CurriculumLanding[] = [
  fiftyTwoLibraryVisitsIn52Weeks,
  greatAmericans37,
  augmentedRealityQuestsMetaQuest3,
  introductionToPersonalCurriculum,
  iainBanksGalacticCivilizationStarterPack,
  computerSkillsForKids,
  standardAlgorithms,
]

export function getLandingContent(idOrSlug: string): CurriculumLanding | null {
  return registry.find((c) => c.curriculumId === idOrSlug || c.slug === idOrSlug) ?? null
}

/** Returns a map of curriculum ID to display overrides for the discover feed. */
export function getDiscoverOverrides(): Map<string, { title: string; slug: string; backgroundImage?: string }> {
  const map = new Map<string, { title: string; slug: string; backgroundImage?: string }>()
  for (const entry of registry) {
    map.set(entry.curriculumId, {
      title: entry.hero.headline,
      slug: entry.slug,
      backgroundImage: entry.hero.backgroundImage,
    })
  }
  return map
}

/** Returns the set of curriculum IDs that have a registry entry. */
export function getRegisteredCurriculumIds(): Set<string> {
  return new Set(registry.map((entry) => entry.curriculumId))
}
