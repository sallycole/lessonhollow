/** Maximum number of player sub-accounts a guide can create */
export const MAX_PLAYERS_PER_GUIDE = 20

/** Canonical grade level options for curriculums */
export const GRADE_LEVELS = [
  'Any',
  'Pre-K',
  'Kindergarten',
  '1st Grade',
  '2nd Grade',
  '3rd Grade',
  '4th Grade',
  '5th Grade',
  '6th Grade',
  '7th Grade',
  '8th Grade',
  '9th Grade',
  '10th Grade',
  '11th Grade',
  '12th Grade',
  'Elementary',
  'Middle School',
  'High School',
  'College',
  'Adult',
] as const

export type GradeLevel = (typeof GRADE_LEVELS)[number]

/** Canonical action types for tasks */
export const ACTION_TYPES = ['Read', 'Watch', 'Listen', 'Do'] as const

export type ActionType = (typeof ACTION_TYPES)[number]
