'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function PublicError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="error-view">
      <AlertTriangle size={48} />
      <h2>Something went wrong</h2>
      <p>An error occurred while loading this page. Please try again.</p>
      <div className="error-actions">
        <button type="button" onClick={reset}>Try again</button>
        <Link href="/" role="button" className="outline">Go home</Link>
      </div>
    </div>
  )
}
