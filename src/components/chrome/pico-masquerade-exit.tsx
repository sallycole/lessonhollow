'use client'

import { hardNavigate } from '@/lib/hard-navigate'

export function PicoMasqueradeExit() {
  return (
    <button
      className="outline contrast"
      onClick={async () => {
        await fetch('/api/auth/masquerade', { method: 'DELETE' })
        hardNavigate('/dashboard')
      }}
    >
      Exit View
    </button>
  )
}
