'use client'

import { AlertTriangle } from 'lucide-react'
import '@picocss/pico/css/pico.conditional.css'
import './app.css'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="pico">
          <main className="container">
            <div className="error-view">
              <AlertTriangle size={48} />
              <h1>Something went wrong</h1>
              <p>An unexpected error occurred. Please try again.</p>
              <div className="error-actions">
                <button type="button" onClick={reset}>Try again</button>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error renders outside the Next.js root, so <Link> is unavailable */}
                <a href="/" role="button" className="outline">Go home</a>
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
