import Link from 'next/link'
import { PicoThemeToggle } from './pico-theme-toggle'
import { PicoViewSwitcher } from './pico-view-switcher'
import { PicoMobileNav } from './pico-mobile-nav'
import type { ChromeSession } from '@/lib/chrome-session'

export function PicoHeader({ session }: { session: ChromeSession }) {
  return (
    <header className="site-header">
      <nav className="site-nav container">
        <ul>
          <li>
            <Link href={session.logoHref} className="wordmark">
              Lesson Hollow
            </Link>
          </li>
        </ul>
        {/* Desktop right side */}
        <ul className="site-nav-desktop">
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
        {/* Mobile right side — hamburger that opens a vertical nav */}
        <PicoMobileNav session={session} />
      </nav>
    </header>
  )
}
