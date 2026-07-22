'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

export function PicoThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Mount detection: the server can't know the resolved theme, so the first
  // client render must match the server (neutral Moon) and only then swap to
  // the real icon. The setState-in-effect is intentional for this guard.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <button
      className="outline theme-toggle"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle theme'}
      suppressHydrationWarning
    >
      {/* Render a neutral placeholder until mounted to avoid hydration mismatch */}
      <span suppressHydrationWarning style={{ display: 'inline-flex' }}>
        {mounted ? (isDark ? <Sun size={18} /> : <Moon size={18} />) : <Moon size={18} />}
      </span>
    </button>
  )
}
