import type { CurriculumLanding } from './types'

const link = (text: string, href: string) =>
  <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>

export const k8AmericanHistory: CurriculumLanding = {
  curriculumId: '7ac5e643-9bf3-4545-9f9e-59f0e3097eeb',
  slug: 'k-8-american-history',
  hero: {
    headline: 'K-8 American History',
    subhead:
      'A chronological path through American history in 214 hand-picked picture books and videos, from first contact to the present day.',
    backgroundImage: '/discover/k-8-american-history-hero-v3.webp',
  },
  ogImage: '/discover/k-8-american-history-hero-v3.webp',
  ogTitle: 'K-8 American History',
  ogDescription:
    'A chronological path through American history in 214 hand-picked picture books and videos, from first contact to the present day.',
  stats: [
    { value: '214', label: 'tasks' },
    { value: 'K-8', label: 'grade span' },
    { value: '1492-2026', label: 'years covered' },
  ],
  proofItems: [
    <span key="companion">
      Companion map and book list live at{' '}
      {link('chiefclanker.com/american-history', 'https://chiefclanker.com/american-history/')}
    </span>,
    'Starts with Columbus in 1492 and ends with driverless cabs and reusable rockets in 2026. Every task sits on a real date.',
    'Most titles are picture books a parent can read aloud. Short videos fill the gaps a picture book cannot cover.',
    'Each description tells you who the child in the story is: a witness, a time traveler, or a historical kid living through the year.',
  ],
  desireBridge: {
    heading: 'Why a dated picture-book sequence beats a textbook',
    paragraph:
      'A textbook compresses centuries into chapters and then asks a child to remember the labels. This path does the opposite. You read or watch one small story set in one year, then the next year arrives. Over 214 tasks the country assembles itself in order, from first contact through the founding, the frontier, industry, wars, and the machines being built now.',
    benefits: [
      {
        title: 'One dated story at a time',
        description:
          'You always know what year you are in. Columbus, Jamestown, the Mayflower, the Constitution, Lewis and Clark, the Civil War, Edison, the Moon landing, and the present sit in a single line you can follow without a scope-and-sequence chart.',
      },
      {
        title: 'Built to be read aloud',
        description:
          'Picture books do the heavy lifting. A younger child can listen while an older sibling reads. When a topic has no good picture book, a short video takes the slot instead of a chapter of gray prose.',
      },
      {
        title: 'The child stays in the frame',
        description:
          'Task notes name the child on the page: a printer’s errand boy on the night of the Tea Party, a Shoshone teenager on the trail west, twins who step into 1773. History is something that happens to someone their size.',
      },
    ],
  },
  ctaLabel: 'Start With Columbus',
  ctaSubtext:
    'We will preload all 214 tasks in chronological order, beginning with Peter Sís on Columbus in 1492.',
  footerReassurance:
    'Keep the date order if you can. Skip any title that does not fit your family. The next year will still be waiting.',
}
