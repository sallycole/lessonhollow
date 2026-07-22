import { CheckCircle, Clock, BarChart3, Users, Share2, ListChecks } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Feature = { icon: LucideIcon; title: string; description: string }

export const hero = {
  headline: 'Your curriculum.',
  tagline: 'Your pace.',
  description:
    'At Lesson Hollow, lifelong learners step up to be guides and their crew steps up to be players on a learning journey. Build curriculums together, knock out daily tasks, and watch the progress stack up.',
  primaryCta: { label: 'Start free, no card required', href: '/signup' },
  secondaryCta: { label: 'Browse curriculums', href: '/discover' },
}

export const features = {
  heading: 'Built for the way you actually learn',
  description:
    'Whether you\'re guiding one child or a whole cohort, or just following your own curiosity, Lesson Hollow gives you the structure without the bureaucracy.',
  items: [
    {
      icon: ListChecks,
      title: 'Build any curriculum',
      description:
        'Import a spreadsheet of learning tasks or create them by hand for any subject, skill, or interest such as schoolwork, hobbies, habits, and challenges.',
    },
    {
      icon: CheckCircle,
      title: 'A clear path every day',
      description:
        'Every day starts with a focused task list you can reorder by drag and drop. Players always know what\'s next, and guides always know what\'s done.',
    },
    {
      icon: Clock,
      title: 'Time that actually counts',
      description:
        'Every task has a built-in timer you can start, pause, and resume. See exactly where the hours go and show players the work they\'ve put in.',
    },
    {
      icon: BarChart3,
      title: 'Progress you can see',
      description:
        'Track subject progress each day from one place. One guide account can follow multiple players at once, each on their own path.',
    },
    {
      icon: Users,
      title: 'Guide one or guide many',
      description:
        'Manage up to 20 players from a single guide account. Works for a family of three, a microschool cohort, or just yourself in solo mode.',
    },
    {
      icon: Share2,
      title: 'Start from a real path',
      description:
        'Use curated curriculum examples and adapt them into a path that fits your learner instead of starting from a blank page.',
    },
  ] as Feature[],
}

export const audiences = {
  heading: 'Who uses Lesson Hollow',
  items: [
    {
      label: 'Homeschool families',
      description:
        'One guide handles multiple children with different curriculums for each. Upload your materials, set the pace, and track the work in one place.',
    },
    {
      label: 'Microschool guides',
      description:
        'You call yourself a guide because that\'s what you are. Lesson Hollow speaks your language and scales to your whole cohort.',
    },
    {
      label: 'Self-directed learners',
      description:
        'Building your own personal curriculum is how curious people learn. Track what you\'re reading, watching, and doing for the joy of it.',
    },
  ],
}

export const cta = {
  heading: 'Start with your first curriculum, free.',
  description:
    'No subscription. No credit card. Your first enrollment is on us. Add credits when you\'re ready to grow.',
  buttonLabel: 'Create your account',
  buttonHref: '/signup',
}
