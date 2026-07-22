'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, params)
  }
}

function sendPageView(path: string) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
    })
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPlayer, setIsPlayer] = useState<boolean | null>(null)

  // Check if current user is a Player — disable analytics for COPPA compliance
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsPlayer(user?.user_metadata?.role === 'player')
    })
  }, [])

  // Track route changes
  useEffect(() => {
    if (!GA_MEASUREMENT_ID || isPlayer) return
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    sendPageView(url)
  }, [pathname, searchParams, isPlayer])

  // Don't render GA script if no measurement ID or user is a Player
  if (!GA_MEASUREMENT_ID || isPlayer === true) {
    return null
  }

  // While checking user role, don't load GA yet
  if (isPlayer === null) {
    return null
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
              send_page_view: false,
              anonymize_ip: true
            });
          `,
        }}
      />
    </>
  )
}
