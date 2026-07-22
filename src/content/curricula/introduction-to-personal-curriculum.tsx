import type { CurriculumLanding } from './types'

const link = (text: string, href: string) =>
  <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>

export const introductionToPersonalCurriculum: CurriculumLanding = {
  curriculumId: '1496e98d-578b-41e4-959b-20e7ed0fe74a',
  slug: 'introduction-to-personal-curriculum',
  hero: {
    headline: 'Introduction to Personal Curriculum',
    subhead:
      'A starter course for anyone who wants to build their own personal curriculum. Learning for the enjoyment of the learner, period. No external justification needed. Any topic is fair game. Study soup, octopuses, Gossip Girl, or whatever sparks curiosity.',
    backgroundImage: '/discover/introduction-to-personal-curriculum-hero.webp',
  },
  ogImage: '/discover/introduction-to-personal-curriculum-hero.webp',
  ogTitle: 'Introduction to Personal Curriculum',
  ogDescription:
    'A starter course for anyone who wants to build their own personal curriculum. Learning for the enjoyment of the learner, period. No external justification needed. Any topic is fair game. Study soup, octopuses, Gossip Girl, or whatever sparks curiosity.',
  stats: [
    { value: '14', label: 'tasks' },
    { value: 'Any', label: 'grade level' },
  ],
  proofItems: [
    <span key="elizabeth-jean">Built around the work of {link('Elizabeth Jean', 'https://linktr.ee/parmesanprincess')}, whose {link('viral TikToks', 'https://www.tiktok.com/@xparmesanprincessx')} launched the #curriculumclub movement</span>,
    'Mixes watching, journaling, and real-world exploration so you discover what actually interests you',
    'Ends with two paths to your first curriculum: build it yourself or let an AI draft one for you',
  ],
  desireBridge: {
    heading: 'Why this works when a blank page does not',
    paragraph:
      'Most people love the idea of a personal curriculum but stall at the starting line. What topics? What order? How much is too much? This course walks you through real examples, gives you journaling prompts to surface your own interests, and hands you the tools to go from curious to enrolled.',
    benefits: [
      {
        title: 'See how someone else does it first',
        description:
          'Watch Elizabeth Jean build her monthly and quarterly curricula from scratch, including the topics she drops and the ones she keeps. Seeing the process demystifies it.',
      },
      {
        title: 'Find your own interests before you plan',
        description:
          'Journaling prompts and a library visit help you discover what you actually want to learn, not what you think you should learn.',
      },
      {
        title: 'Two ways to build your first curriculum',
        description:
          'Follow a step-by-step guide to build your own curriculum file, or use an AI prompt to generate one from your interests. Either way, you walk out with something ready to load.',
      },
    ],
  },
  ctaLabel: 'Start This Course',
  ctaSubtext:
    'By the end you will have your own personal curriculum ready to go.',
  footerReassurance:
    'Skip any task that does not fit your style. The course is a guide, not a gate. Take what works and leave the rest.',
}