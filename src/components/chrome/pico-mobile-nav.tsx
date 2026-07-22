'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { PicoThemeToggle } from './pico-theme-toggle'
import { PicoViewSwitcher } from './pico-view-switcher'
import { FeedbackButton } from '@/components/feedback-modal'
import type { ChromeSession } from '@/lib/chrome-session'

export function PicoMobileNav({ session }: { session: ChromeSession }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)

  // Close on outside click — Pico's <details class="dropdown"> opens via the
  // browser default; outside-click close is our small ergonomic add.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const node = detailsRef.current
      if (!node || !node.open) return
      if (!node.contains(e.target as Node)) node.open = false
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // Firefox suppresses the native <details> toggle when <summary> carries
  // role="button" (ARIA role overrides the native disclosure activation).
  // Toggle in JS so the dropdown works in both Chromium and Firefox.
  function toggle(e: React.SyntheticEvent) {
    e.preventDefault()
    const node = detailsRef.current
    if (node) node.open = !node.open
  }
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') toggle(e)
  }

  return (
    <details ref={detailsRef} className="dropdown site-nav-mobile">
      <summary role="button" className="outline" aria-label="Open menu" onClick={toggle} onKeyDown={handleKey}>
        <Menu size={18} />
      </summary>
      <ul>
        <li>
          <Link href="/discover">Discover</Link>
        </li>
        <li>
          <Link href="/pricing">Pricing</Link>
        </li>
        <li>
          <Link href="/blog">Blog</Link>
        </li>
        <li>
          <FeedbackButton asMenuItem />
        </li>
        <li>
          <hr />
        </li>
        <li>
          <PicoThemeToggle />
        </li>
        {session.isLoggedIn ? (
          <li>
            <PicoViewSwitcher
              mode={session.isPlayerView && !session.isGuide ? 'player' : 'guide'}
              playerName={session.playerName}
              masqueradePlayerId={session.masquerade?.playerId}
              masqueradePlayerName={session.masquerade?.playerName}
              players={session.players}
            />
          </li>
        ) : (
          <>
            <li>
              <Link href="/signup" role="button">
                Sign Up
              </Link>
            </li>
            <li>
              <Link href="/login" role="button" className="outline">
                Log In
              </Link>
            </li>
          </>
        )}
      </ul>
    </details>
  )
}
