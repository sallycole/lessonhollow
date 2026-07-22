'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { completeOnboarding } from '@/lib/onboarding/player-actions'

export type CurriculumActionResult = {
  error?: string
}

/**
 * Complete onboarding and send the user to the curriculum detail page
 * so they can browse it and enroll.
 */
export async function chooseCurriculumOnboarding(
  curriculumId: string
): Promise<CurriculumActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }

  await completeOnboarding()
  redirect(`/discover/${curriculumId}`)
}

/**
 * Complete onboarding and redirect to the build-your-own path.
 * Desktop goes to CSV upload, mobile goes to manual entry.
 */
export async function buildYourOwnOnboarding(
  isMobile: boolean
): Promise<CurriculumActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }

  await completeOnboarding()

  if (isMobile) {
    redirect('/curriculums/new?tab=manual&from=onboarding')
  } else {
    redirect('/curriculums/new?tab=csv')
  }
}

/**
 * Skip the curriculum step entirely and complete onboarding.
 */
export async function skipCurriculumOnboarding(): Promise<CurriculumActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }

  await completeOnboarding()
  redirect('/dashboard')
}
