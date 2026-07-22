'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export type ForgotPasswordState = {
  error?: string
  submitted?: boolean
}

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = formData.get('email') as string

  if (!email) {
    return { error: 'Email is required.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  const { allowed, retryAfterMs } = checkRateLimit(`reset:${email}`, 3, 60_000)
  if (!allowed) {
    const seconds = Math.ceil(retryAfterMs / 1000)
    return { error: `Too many attempts. Please try again in ${seconds} seconds.` }
  }

  const supabase = await createClient()

  // Fire and forget — we show a generic confirmation regardless
  // to prevent email enumeration and timing-based attacks
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/reset-password`,
  })

  return { submitted: true }
}
