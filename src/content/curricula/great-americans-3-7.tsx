import type { CurriculumLanding } from './types'

const link = (text: string, href: string) =>
  <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>

export const greatAmericans37: CurriculumLanding = {
  curriculumId: '39836b68-99e1-4139-9288-0f1d2cffeb8e',
  slug: 'great-americans-ages-3-7',
  hero: {
    headline: 'A Library to Build Great Americans (Ages 3–7)',
    subhead:
      'A guided reading path for ages 3–7, built for families and learners who want real structure. From Hans Christian Andersen and the Brothers Grimm through Laura Ingalls Wilder and E.B. White: fairy tales, fables, picture books, and chapter books in one sequence you can actually follow.',
    backgroundImage: '/discover/great-americans-ages-3-7-hero-v2.webp',
  },
  ogImage: '/discover/great-americans-ages-3-7-hero-v2.webp',
  ogTitle: 'A Library to Build Great Americans (Ages 3–7)',
  ogDescription:
    'A guided reading path for ages 3–7, built for families and learners who want real structure. From Hans Christian Andersen and the Brothers Grimm through Laura Ingalls Wilder and E.B. White: fairy tales, fables, picture books, and chapter books in one sequence you can actually follow.',
  proofItems: [
    <span key="educated-and-free">Built from the {link('Educated and Free book list', 'https://educatedandfree.substack.com/p/a-library-to-build-great-americans')}, shared and saved by thousands of families</span>,
    'Features universally loved authors: Andersen, Grimm, Kipling, Seuss, Sendak, Wilder, E.B. White',
    'All reading tasks preserve the affiliate links that reward the list’s curator',
  ],
  desireBridge: {
    heading: 'Why 1,294 readings actually becomes doable',
    paragraph:
      'A list this long looks impossible in a spreadsheet. Inside Lesson Hollow, it becomes a clear daily path: one reading at a time, every resource linked, every session tracked. You never have to wonder what comes next or rebuild the list yourself.',
  },
  ctaLabel: 'Make This My First Curriculum',
  ctaSubtext: 'We’ll preload this reading path so you can start with the first story, not a blank page.',
  footerReassurance:
    'You can start with this sequence as-is, skip what doesn’t fit your family, and still keep the structure intact. The path is yours to adapt.',
}