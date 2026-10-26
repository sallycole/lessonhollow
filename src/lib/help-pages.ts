export type HelpPageItem = {
  label: string
  href: string
}

export type HelpSection = {
  heading: string
  items: HelpPageItem[]
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    heading: 'Tips for You',
    items: [
      { label: 'Building a Curriculum File', href: '/help/tips/building-a-curriculum-file' },
      { label: 'Forking the Lesson Hollow Repo', href: '/help/tips/forking-the-lesson-hollow-repo' },
    ],
  },
  {
    heading: 'Tips for Your LLM',
    items: [
      { label: 'Building a Curriculum File', href: '/help/llm/building-a-curriculum-file' },
      { label: 'Using Open Source Curriculum Files', href: '/help/llm/using-open-source-curriculum-files' },
    ],
  },
]

export function getPublicHelpPagePaths(): string[] {
  return HELP_SECTIONS.flatMap((section) => section.items.map((item) => item.href))
}
