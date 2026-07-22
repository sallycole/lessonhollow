import { Suspense } from 'react'
import { AccountForm } from './account-form'

export default function OnboardingAccountPage() {
  return (
    <Suspense>
      <AccountForm />
    </Suspense>
  )
}
