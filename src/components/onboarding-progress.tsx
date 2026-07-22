const STEPS = [
  { label: 'Account', path: '/onboarding/account' },
  { label: 'Players', path: '/onboarding/players' },
  { label: 'Curriculum', path: '/onboarding/curriculum' },
] as const

export function OnboardingProgress({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <nav className="onboarding-progress" aria-label="Onboarding progress">
      <ol>
        {STEPS.map((step, idx) => {
          const stepNum = idx + 1
          const state =
            stepNum < currentStep
              ? 'completed'
              : stepNum === currentStep
                ? 'active'
                : 'upcoming'
          return (
            <li key={step.label} data-state={state}>
              <span className="step-num" aria-hidden="true">
                {state === 'completed' ? '✓' : stepNum}
              </span>
              <span className="step-label">{step.label}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
