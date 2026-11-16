import { describe, it, expect } from 'vitest'
import { META_DESCRIPTION_MAX_CHARS, trimMetaDescription } from '../seo'
import { getLandingContent, getRegisteredCurriculumIds } from '@/content/curricula'
import { getPostBySlug, blogDocumentTitle } from '../blog'


const OVER_LIMIT = {
  library:
    'A year-long, joy-first library adventure that turns libraries into places for discovery, creativity, useful life skills, and little weekly quests worth talking about.',
  greatAmericans:
    'A guided reading path for ages 3–7, built for families and learners who want real structure. From Hans Christian Andersen and the Brothers Grimm through Laura Ingalls Wilder and E.B. White: fairy tales, fables, picture books, and chapter books in one sequence you can actually follow.',
  arQuests:
    'Play twelve mixed-reality games for Meta Quest 3, each with three concrete challenges to finish. Solve puzzles on your kitchen table, drum through full songs, race campaign tracks across the floor, build dungeons over your real furniture, and follow a story that turns your room into a working spaceship.',
  personalCurriculum:
    'A starter course for anyone who wants to build their own personal curriculum. Learning for the enjoyment of the learner, period. No external justification needed. Any topic is fair game. Study soup, octopuses, Gossip Girl, or whatever sparks curiosity.',
  iainBanks:
    "Read the two Culture novels that sit at the heart of Elon Musk's galactic civilization talk. You start with a clip of Musk invoking Iain M. Banks' Outside Context Problem on a live broadcast, then work through “The Player of Games” and “Excession” chapter by chapter. By the end you have the original concept in hand, ready to hear what Musk borrowed.",
  computerSkills:
    'Nineteen hands-on lessons that turn a kid from a passive screen-user into someone who can use AI well, secure their own accounts, make media, and publish work the world can see.',
  standardAlgorithms:
    'A procedure-first path from carrying-the-one to long division with two-digit divisors. Each algorithm gets a short Math Antics video, a worksheet worked by hand, and Khan Academy practice drilled until it reads Mastered.',
  homepage:
    'At Lesson Hollow, lifelong learners step up to be guides and their crew steps up to be players on a learning journey. Build curriculums together, knock out daily tasks, and watch the progress stack up.',
}

describe('trimMetaDescription', () => {
  it('leaves copy at or under the budget unchanged, aside from dash normalization', () => {
    const short =
      'A chronological path through American history in 214 hand-picked picture books and videos, from first contact to the present day.'
    expect(short.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_CHARS)
    expect(trimMetaDescription(short)).toBe(short)
  })

  it('keeps the longest run of complete sentences that still fits', () => {
    expect(trimMetaDescription(OVER_LIMIT.greatAmericans)).toBe(
      'A guided reading path for ages 3 to 7, built for families and learners who want real structure.',
    )
    expect(trimMetaDescription(OVER_LIMIT.arQuests)).toBe(
      'Play twelve mixed-reality games for Meta Quest 3, each with three concrete challenges to finish.',
    )
    expect(trimMetaDescription(OVER_LIMIT.personalCurriculum)).toBe(
      'A starter course for anyone who wants to build their own personal curriculum. Learning for the enjoyment of the learner, period.',
    )
    expect(trimMetaDescription(OVER_LIMIT.iainBanks)).toBe(
      "Read the two Culture novels that sit at the heart of Elon Musk's galactic civilization talk.",
    )
    expect(trimMetaDescription(OVER_LIMIT.standardAlgorithms)).toBe(
      'A procedure-first path from carrying-the-one to long division with two-digit divisors.',
    )
    expect(trimMetaDescription(OVER_LIMIT.homepage)).toBe(
      'At Lesson Hollow, lifelong learners step up to be guides and their crew steps up to be players on a learning journey.',
    )
  })

  it('does not treat initials such as Iain M. Banks as sentence breaks', () => {
    const trimmed = trimMetaDescription(OVER_LIMIT.iainBanks)
    expect(trimmed).not.toMatch(/Iain M\.$/)
    expect(trimmed.endsWith('talk.')).toBe(true)
  })

  it('falls back to a clause boundary when a single sentence is over the budget', () => {
    expect(trimMetaDescription(OVER_LIMIT.library)).toBe(
      'A year-long, joy-first library adventure that turns libraries into places for discovery, creativity, useful life skills.',
    )
    expect(trimMetaDescription(OVER_LIMIT.computerSkills)).toBe(
      'Nineteen hands-on lessons that turn a kid from a passive screen-user into someone who can use AI well, secure their own accounts, make media.',
    )
  })

  it('falls back to a word boundary when there is no usable sentence or clause', () => {
    const text =
      'Amazing outstanding wonderful incredible remarkable extraordinary spectacular phenomenal curriculum path everybody talks about constantly everywhere'
    const trimmed = trimMetaDescription(text, 80)
    expect(trimmed.length).toBeLessThanOrEqual(80)
    expect(trimmed.includes(' ')).toBe(true)
    expect(trimmed.endsWith(' ')).toBe(false)
  })

  it('brings every current over-limit public description to 155 or fewer characters', () => {
    for (const [name, text] of Object.entries(OVER_LIMIT)) {
      const trimmed = trimMetaDescription(text)
      expect(trimmed.length, name).toBeLessThanOrEqual(META_DESCRIPTION_MAX_CHARS)
      expect(trimmed.length, name).toBeGreaterThan(60)
      expect(trimmed).not.toContain('\u2013')
      expect(trimmed).not.toContain('\u2014')
    }
  })
})

describe('public page metadata after the trimmer and seoTitle', () => {
  const discoverSlugs = [
    'k-8-american-history',
    '52-library-visits-in-52-weeks',
    'great-americans-ages-3-7',
    'augmented-reality-quests-meta-quest-3',
    'introduction-to-personal-curriculum',
    'iain-banks-galactic-civilization-starter-pack',
    'computer-skills-for-kids',
    'standard-algorithms',
  ]

  it('covers every registered Discover landing', () => {
    expect(getRegisteredCurriculumIds().size).toBe(discoverSlugs.length)
    for (const slug of discoverSlugs) {
      expect(getLandingContent(slug), slug).not.toBeNull()
    }
  })

  it('trims every Discover meta and social description to 155 or fewer', () => {
    for (const slug of discoverSlugs) {
      const landing = getLandingContent(slug)!
      const description = trimMetaDescription(landing.hero.subhead)
      const social = trimMetaDescription(landing.ogDescription ?? description)
      expect(description.length, `${slug} description`).toBeLessThanOrEqual(
        META_DESCRIPTION_MAX_CHARS,
      )
      expect(social.length, `${slug} og:description`).toBeLessThanOrEqual(
        META_DESCRIPTION_MAX_CHARS,
      )
    }
  })

  it('gives the planners post a search title under 60 characters with no dash separator', () => {
    const post = getPostBySlug('best-homeschool-planners-under-20')
    expect(post).not.toBeNull()
    expect(post!.title).toBe('Best Homeschool Planners for Under $20 per Year')
    const title = blogDocumentTitle(post!)
    expect(title.length).toBeLessThanOrEqual(60)
    expect(title).toBe('Best Homeschool Planners Under $20 a Year | Lesson Hollow')
    expect(title).not.toMatch(/[\u2013\u2014]|\s-\s/)
    expect(post!.description).toBe(post!.socialDescription)
    expect(post!.description!.length).toBeGreaterThanOrEqual(120)
    expect(post!.description!.length).toBeLessThanOrEqual(155)
    expect(post!.description).toContain('under $20 a year')
    expect(post!.description).not.toContain('$10 to $20')
  })
})
