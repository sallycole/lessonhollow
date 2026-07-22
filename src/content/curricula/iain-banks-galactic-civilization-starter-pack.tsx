import type { CurriculumLanding } from './types'

const link = (text: string, href: string) =>
  <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>

export const iainBanksGalacticCivilizationStarterPack: CurriculumLanding = {
  curriculumId: 'ccdb0945-0123-4093-bf54-4ed5b44b550d',
  slug: 'iain-banks-galactic-civilization-starter-pack',
  hero: {
    headline: "Iain M. Banks' Galactic Civilization Starter Pack",
    subhead:
      "Read the two Culture novels that sit at the heart of Elon Musk's galactic civilization talk. You start with a clip of Musk invoking Iain M. Banks' Outside Context Problem on a live broadcast, then work through “The Player of Games” and “Excession” chapter by chapter. By the end you have the original concept in hand, ready to hear what Musk borrowed.",
    backgroundImage: '/discover/excession-hero.webp',
  },
  stats: [
    { value: '22', label: 'tasks' },
    { value: '2', label: 'Culture novels' },
    { value: 'For adults', label: '' },
  ],
  proofItems: [
    'Anchored in a real moment: Elon Musk naming Banks’ Outside Context Problem on a live X broadcast',
    <span key="culture-series">Centers on {link('The Culture series', 'https://en.wikipedia.org/wiki/Culture_series')}, starting with “The Player of Games” and “Excession,” the two books where the concept lives</span>,
    'Closes with a Culture-lore deep dive on the Interesting Times Gang, the Minds Banks invented to handle Outside Context Problems',
  ],
  proofQuote: {
    text:
      'An Outside Context Problem was the sort of thing most civilisations encountered just once, and which they tended to encounter rather in the same way a sentence encountered a full stop.',
    attribution: 'Iain M. Banks, “Excession”',
  },
  desireBridge: {
    heading: 'Why this works when the Culture can feel impossibly large',
    benefits: [
      {
        title: 'Start from a moment you have already seen',
        description:
          'The first task is a short clip of Musk on a live broadcast naming the concept. You don’t have to adore Musk to start here. It is there because it is real, and it makes the abstract suddenly concrete.',
      },
      {
        title: 'Two books is a finishable number',
        description:
          '“The Player of Games” is the Culture novel most people start with. “Excession” is the one where the Outside Context Problem gets its name. Reading those two in order gives you the concept in its native habitat without committing to the whole ten-book series.',
      },
      {
        title: 'Chapter by chapter instead of all or nothing',
        description:
          'Each chapter is its own task. You can finish one, mark it done, come back the next day, and keep moving. The path never asks you to read a whole book in one sitting.',
      },
    ],
  },
  ctaLabel: 'Start this Curriculum',
  reentryHint: 'It’ll be fun!',
  ogImage: '/og/banks-starter-pack-og.jpg',
  ogTitle: "Iain M. Banks' Galactic Civilization Starter Pack",
  ogDescription:
    "Two Culture novels framed by the concept Musk just invoked on live X: Iain M. Banks' Outside Context Problem. Read with spoiler-free context first.",
}
