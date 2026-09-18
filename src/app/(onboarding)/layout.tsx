import type { Metadata } from 'next'
import { OnboardingProgressWrapper } from './onboarding-progress-wrapper'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="onboarding-shell">
      <OnboardingProgressWrapper />
      {children}
    </div>
  )
}
