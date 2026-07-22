'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/lib/navigation'

export function PicoNavTabs({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  if (items.length === 0) return null

  return (
    <nav className="player-tabs" aria-label="Main navigation">
      <ul className="container">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={isActive ? 'page' : undefined}>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
