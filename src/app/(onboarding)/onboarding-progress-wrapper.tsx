'use client'

import { usePathname } from 'next/navigation'
import { OnboardingProgress } from '@/components/onboarding-progress'

function stepFromPathname(pathname: string): 1 | 2 | 3 {
  if (pathname.startsWith('/onboarding/curriculum')) return 3
  if (pathname.startsWith('/onboarding/players')) return 2
  return 1
}

export function OnboardingProgressWrapper() {
  const pathname = usePathname()
  return <OnboardingProgress currentStep={stepFromPathname(pathname)} />
}
