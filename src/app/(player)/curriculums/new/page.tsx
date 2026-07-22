import { Suspense } from 'react'
import { CurriculumForm } from './curriculum-form'
import { CsvUpload } from './csv-upload'
import { CreationMethodTabs } from './creation-method-tabs'
import { OnboardingBanner } from './onboarding-banner'

export default function NewCurriculumPage() {
  return (
    <div className="new-curriculum-shell">
      <hgroup className="new-curriculum-header">
        <h1>New Curriculum</h1>
        <p>Create a new curriculum to organize tasks and lessons.</p>
      </hgroup>
      <Suspense>
        <OnboardingBanner />
      </Suspense>
      <Suspense>
        <CreationMethodTabs
          manualForm={<CurriculumForm />}
          csvUpload={<CsvUpload />}
        />
      </Suspense>
    </div>
  )
}
