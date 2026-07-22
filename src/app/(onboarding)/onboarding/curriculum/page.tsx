import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { getRegisteredCurriculumIds } from '@/content/curricula'
import { CurriculumStep } from './curriculum-step'

export const dynamic = 'force-dynamic'

export default async function OnboardingCurriculumPage() {
  // Fetch public curricula for browsing, filtered to registered ones only.
  // The onboarding "browse" step shows hand-selected curriculums that have
  // a registry entry with promo content.
  let curricula: { id: string; name: string; public_title?: string | null; public_description?: string | null; grade_level?: string | null; tasks: { count: number }[] }[] = []

  try {
    const result = await db.getPublicCurricula(1, 100, 'copies')
    const registeredIds = getRegisteredCurriculumIds()
    curricula = ((result.data ?? []) as typeof curricula).filter((c) => registeredIds.has(c.id))
  } catch {
    // Supabase not configured
  }

  // Read device class from middleware cookie
  const cookieStore = await cookies()
  const isMobile = cookieStore.get('device-class')?.value === 'mobile'

  return (
    <CurriculumStep
      curricula={curricula}
      isMobile={isMobile}
    />
  )
}
