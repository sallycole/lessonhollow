export type NavItem = { label: string; href: string }

export const guideNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Manage Players', href: '/players' },
  { label: 'Manage Account', href: '/account' },
  { label: 'Manage Credits', href: '/credits' },
]

export const playerNav: NavItem[] = [
  { label: 'Today', href: '/today' },
  { label: 'Plan', href: '/plan' },
  { label: 'Log', href: '/log' },
  { label: 'Enrollments', href: '/enrollments' },
  { label: 'Curriculums', href: '/curriculums' },
  { label: 'Progress', href: '/progress' },
  { label: 'Rewards', href: '/rewards' },
]

export const publicNav: NavItem[] = [
  { label: 'Blog', href: '/blog' },
]
