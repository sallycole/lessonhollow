import type { CurriculumLanding } from './types'

export const standardAlgorithms: CurriculumLanding = {
  curriculumId: 'a85d3e86-3ee6-4209-aaa2-5eb26dde44dc',
  slug: 'standard-algorithms',
  hero: {
    headline: 'The Standard Algorithms: Arithmetic to Mastery',
    subhead:
      'A procedure-first path from carrying-the-one to long division with two-digit divisors. Each algorithm gets a short Math Antics video, a worksheet worked by hand, and Khan Academy practice drilled until it reads Mastered.',
    backgroundImage: '/discover/standard-algorithms-hero-v2.webp',
  },
  stats: [
    { value: '4', label: 'algorithms' },
    { value: '24', label: 'steps' },
    { value: 'Free', label: 'materials' },
  ],
  proofItems: [
    'Every video, worksheet, and practice set is free. Math Antics and Khan Academy, nothing to buy.',
    'Works as a first pass for a younger kid or as targeted repair for an older one with a shaky spot.',
    'Each algorithm ends in a Khan Academy set you drill until it reads Mastered, so you know it actually stuck.',
    'Finishes with decimal arithmetic, which proves the same four algorithms carry past whole numbers.',
  ],
  proofQuote: {
    text:
      'Understanding and fluency are not the same thing. A kid can nod along to why long division works and still freeze at the actual steps. This path drills the steps until the hand knows them, and then the understanding has somewhere to live.',
    attribution: 'Chief Clanker',
  },
  desireBridge: {
    heading: 'Why this curriculum works',
    paragraph:
      'Most programs teach the idea and hope fluency follows. This one flips the order. Your kid watches a five-minute explainer, works a paper worksheet, then drills the matching Khan Academy set until it locks in. Four algorithms, one at a time, in the order they build on each other.',
    benefits: [
      {
        title: 'Procedure first, then drilled to stick',
        description:
          'Every algorithm gets a short video, a worksheet done by hand, and Khan Academy practice you run until it reads Mastered. Nothing moves on until the steps are automatic.',
      },
      {
        title: 'Built for beginners and for repair',
        description:
          'Start a younger kid at multi-digit addition, or drop an older one straight into long division to close the gap they never did. Skip anything already solid.',
      },
      {
        title: 'Nothing to buy',
        description:
          'The whole path runs on free Math Antics videos, their free companion worksheets with answer keys, and free Khan Academy drills. You supply a pencil.',
      },
    ],
  },
  ctaLabel: 'Start With Addition',
  ctaSubtext:
    'We’ll preload all 24 steps in order, starting with multi-digit addition so each algorithm builds on the one before it.',
  footerReassurance:
    'Work the four algorithms in order, or jump straight to the one your kid is stuck on. Skip anything they’ve already mastered. Every video and worksheet stays free, and the practice is theirs to redo as many times as it takes.',
  ogImage: '/discover/standard-algorithms-hero-v2.webp',
  ogTitle: 'The Standard Algorithms: Arithmetic to Mastery',
  ogDescription:
    'A free, procedure-first path through the four standard arithmetic algorithms: addition, subtraction, long multiplication, and long division. Short videos, worksheets, and Khan Academy drills to mastery.',
}
