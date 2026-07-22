import { OnboardingProgressWrapper } from './onboarding-progress-wrapper'

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
