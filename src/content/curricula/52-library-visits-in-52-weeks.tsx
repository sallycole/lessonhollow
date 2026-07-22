import type { CurriculumLanding } from './types'

const link = (text: string, href: string) =>
  <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>

export const fiftyTwoLibraryVisitsIn52Weeks: CurriculumLanding = {
  curriculumId: '38eda0b4-8947-4c55-a68d-21a41a8df8c7',
  slug: '52-library-visits-in-52-weeks',
  hero: {
    headline: '52 Library Visits in 52 Weeks',
    subhead:
      'A year-long, joy-first library adventure that turns libraries into places for discovery, creativity, useful life skills, and little weekly quests worth talking about.',
    backgroundImage: '/discover/52-library-visits-in-52-weeks-hero.webp',
  },
  ogImage: '/discover/52-library-visits-in-52-weeks-hero.webp',
  ogTitle: '52 Library Visits in 52 Weeks',
  ogDescription: 'A year-long, joy-first library adventure that turns libraries into places for discovery, creativity, useful life skills, and little weekly quests worth talking about.',
  stats: [
    { value: '52+', label: 'quests' },
    { value: 'Any', label: 'grade level' },
  ],
  proofItems: [
    'One focused quest per week — no overwhelm, just consistent wonder and small wins',
    'Covers every way to use a library: read, watch, listen, do, talk to librarians, explore new branches, and hunt for hidden gems',
    'Builds real skills (research, navigation, conversation, creativity) while making the library feel like an adventure hub instead of just a building',
  ],
  desireBridge: {
    heading: 'Why a year of library quests beats random visits',
    paragraph:
      'Most people walk into a library, wander the same sections, and leave with whatever is handy. This curriculum gives every visit a tiny, delightful mission. Over 52 weeks you will have read genres you never tried, watched surprising documentaries, learned practical tricks from how-to books, traded at Little Free Libraries, attended events, and come home with stories worth telling at dinner.',
    benefits: [
      {
        title: 'One quest per week keeps it joyful and doable',
        description:
          'Each task is small and specific: “Check out a book about disasters,” “Ask a librarian for a recommendation,” “Find the oldest book in the building,” “Trade at a mini neighborhood library.” You always know exactly what to hunt for.',
      },
      {
        title: 'Discover what your actual library can do for you',
        description:
          'Beyond books you will borrow movies, try audiobooks, use public computers, attend events, hunt Little Free Libraries, and borrow unexpected things like tools or museum passes. You will know your local libraries inside out.',
      },
      {
        title: 'Build a lifelong habit without burnout',
        description:
          'The structure is light: one adventure a week. Skip anything that does not fit your library or your mood. Repeat the ones you love. The year adds up to real exploration and a much deeper relationship with libraries.',
      },
    ],
  },
  ctaLabel: 'Start the Library Quest',
  ctaSubtext:
    'We will preload the full set of 52+ quests so your next library visit has a clear, fun mission waiting.',
  footerReassurance:
    'Do the quests in any order. Adapt them to whatever your local branch actually has. The goal is joy and discovery, not checking boxes. Take what works and make it yours.',
}