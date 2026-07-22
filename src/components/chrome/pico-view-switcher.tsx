'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, LogOut } from 'lucide-react'
import { hardNavigate } from '@/lib/hard-navigate'

export type SwitcherPlayer = {
  id: string
  first_name: string
  last_name: string
  isGuidePlayer: boolean
}

type Props = {
  mode: 'guide' | 'player'
  playerName?: string
  masqueradePlayerId?: string | null
  masqueradePlayerName?: string | null
  players?: SwitcherPlayer[]
}

export function PicoViewSwitcher({
  mode,
  playerName,
  masqueradePlayerId,
  masqueradePlayerName,
  players = [],
}: Props) {
  const router = useRouter()
  const detailsRef = useRef<HTMLDetailsElement>(null)

  // Close the dropdown when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const node = detailsRef.current
      if (!node || !node.open) return
      if (!node.contains(e.target as Node)) node.open = false
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  function close() {
    if (detailsRef.current) detailsRef.current.open = false
  }

  // Firefox quirk: native <details> toggle can be unreliable when <summary>
  // carries role="button". Toggle in JS so both Chromium and Firefox behave.
  function toggle(e: React.SyntheticEvent) {
    e.preventDefault()
    const node = detailsRef.current
    if (node) node.open = !node.open
  }
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') toggle(e)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    hardNavigate('/')
  }

  if (mode === 'player') {
    const label = playerName ? `${playerName}’s View` : 'Player’s View'
    return (
      <details ref={detailsRef} className="dropdown view-switcher">
        <summary role="button" className="outline" onClick={toggle} onKeyDown={handleKey}>{label}</summary>
        <ul>
          <li>
            <button className="contrast" onClick={handleLogout}>
              <LogOut size={14} /> Logout
            </button>
          </li>
        </ul>
      </details>
    )
  }

  const triggerLabel = masqueradePlayerName
    ? `${masqueradePlayerName}'s View`
    : "Guide's View"

  async function selectPlayer(playerId: string) {
    close()
    await fetch(`/api/auth/masquerade?player=${playerId}`, { method: 'POST' })
    hardNavigate('/today')
  }

  async function selectGuide() {
    close()
    if (masqueradePlayerId) {
      await fetch('/api/auth/masquerade', { method: 'DELETE' })
      hardNavigate('/dashboard')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <details ref={detailsRef} className="dropdown view-switcher">
      <summary role="button" className="outline" onClick={toggle} onKeyDown={handleKey}>{triggerLabel}</summary>
      <ul>
        <li>
          <button onClick={selectGuide} className="menu-item">
            {!masqueradePlayerId ? <Check size={14} /> : <span className="check-spacer" />}
            Guide&apos;s View
          </button>
        </li>
        {players.map((p) => {
          const isActive = p.id === masqueradePlayerId
          const label = p.isGuidePlayer ? 'Your Player View' : `${p.first_name} ${p.last_name}'s View`
          return (
            <li key={p.id}>
              <button
                disabled={isActive}
                onClick={() => {
                  if (!isActive) selectPlayer(p.id)
                }}
                className="menu-item"
              >
                {isActive ? <Check size={14} /> : <span className="check-spacer" />}
                {label}
              </button>
            </li>
          )
        })}
        <li>
          <hr />
        </li>
        <li>
          <button onClick={handleLogout} className="menu-item">
            <LogOut size={14} /> Logout
          </button>
        </li>
      </ul>
    </details>
  )
}
