'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = [
  {
    heading: 'Tips for You',
    items: [
      { label: 'Building a Curriculum File', href: '/help/tips/building-a-curriculum-file' },
    ],
  },
  {
    heading: 'Tips for Your LLM',
    items: [
      { label: 'Building a Curriculum File', href: '/help/llm/building-a-curriculum-file' },
    ],
  },
]

export function HelpNav() {
  const pathname = usePathname()

  return (
    <nav className="help-nav" aria-label="Help navigation">
      {SECTIONS.map((section) => (
        <div key={section.heading}>
          <h4>{section.heading}</h4>
          <ul>
            {section.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
