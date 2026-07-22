'use client'

import { useState } from 'react'
import Link from 'next/link'

export function LowBalanceBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <aside className="low-balance-banner" role="status">
      <p>
        Running low on credits — <Link href="/credits">Top up now →</Link>
      </p>
      <button
        type="button"
        className="dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss low balance warning"
      >
        ✕
      </button>
    </aside>
  )
}
