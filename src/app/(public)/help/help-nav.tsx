'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HELP_SECTIONS } from '@/lib/help-pages'

export function HelpNav() {
  const pathname = usePathname()

  return (
    <nav className="help-nav" aria-label="Help navigation">
      {HELP_SECTIONS.map((section) => (
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
