import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { GoogleAnalytics } from '@/components/analytics'
import { Toaster } from '@/components/ui/sonner'
import { StaleDeployHandler } from '@/components/stale-deploy-handler'
import { getChromeSession } from '@/lib/chrome-session'
import { PicoMasquerade } from '@/components/chrome/pico-masquerade'
import { PicoHeader } from '@/components/chrome/pico-header'
import { PicoNavTabs } from '@/components/chrome/pico-nav-tabs'
import { PicoFooter } from '@/components/chrome/pico-footer'
import '@picocss/pico/css/pico.conditional.css'
import './app.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lessonhollow.com'),
  title: 'Lesson Hollow',
  description: 'Build your curriculum. Track your progress. Share your path.',
  openGraph: {
    title: 'Lesson Hollow',
    description: 'Build your curriculum. Track your progress. Share your path.',
    images: [
      {
        url: '/og/lesson-hollow-collage-og.png',
        width: 1200,
        height: 630,
        alt: 'Lesson Hollow',
      },
    ],
    siteName: 'Lesson Hollow',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lesson Hollow',
    description: 'Build your curriculum. Track your progress. Share your path.',
    images: ['/og/lesson-hollow-collage-og.png'],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getChromeSession()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Lesson Hollow Blog"
          href="/feed.xml"
        />
      </head>
      <body>
        <ThemeProvider>
          <Suspense fallback={null}>
            <GoogleAnalytics />
          </Suspense>
          <div className="pico pico-shell">
            <PicoMasquerade />
            <PicoHeader session={session} />
            <PicoNavTabs items={session.navItems} />
            <main className="container">{children}</main>
            <PicoFooter />
          </div>
          <Toaster />
          <StaleDeployHandler />
        </ThemeProvider>
      </body>
    </html>
  )
}
