'use client'

import { useSearchParams } from 'next/navigation'

export function OnboardingBanner() {
  const searchParams = useSearchParams()
  const fromOnboarding = searchParams.get('from') === 'onboarding'

  if (!fromOnboarding) return null

  return (
    <article className="onboarding-banner" role="status">
      <p>
        You can start building your curriculum right here on your phone. Add a
        title and your first few tasks now, then fill in the rest later from a
        desktop computer.
      </p>
    </article>
  )
}
