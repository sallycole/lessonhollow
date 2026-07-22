'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'
import { createPlayerForGuide } from '@/lib/onboarding/player-actions'
import { sendWelcomeEmail } from '@/lib/notifications'
import { z } from 'zod'

export type AccountActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  needsPlayerRetry?: boolean
}

const accountSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  firstName: z.string().min(1, 'First name is required.').max(100),
  lastName: z.string().min(1, 'Last name is required.').max(100),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters.')
    .max(30, 'Username must be at most 30 characters.')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Letters, numbers, hyphens, and underscores only.'
    ),
  timezone: z.string().min(1, 'Time zone is required.'),
})

export async function createAccountAndPlayer(
  formData: FormData
): Promise<AccountActionState> {
  const raw = {
    email: (formData.get('email') as string)?.trim(),
    password: (formData.get('password') as string) ?? '',
    firstName: (formData.get('firstName') as string)?.trim(),
    lastName: (formData.get('lastName') as string)?.trim(),
    username: (formData.get('username') as string)?.trim(),
    timezone: formData.get('timezone') as string,
  }

  const result = accountSchema.safeParse(raw)
  if (!result.success) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const data = result.data

  // Rate limit
  const { allowed, retryAfterMs } = checkRateLimit(`signup:${data.email}`, 3, 60_000)
  if (!allowed) {
    const seconds = Math.ceil(retryAfterMs / 1000)
    return { error: `Too many attempts. Please try again in ${seconds} seconds.` }
  }

  // Check username uniqueness before creating the guide account
  const { data: existingPlayer } = await db.getPlayerByUsernameCaseInsensitive(data.username)
  if (existingPlayer) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: { username: ['This username is already taken.'] },
    }
  }

  // Create guide auth account
  const supabase = await createClient()

  const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: callbackUrl,
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
        timezone: data.timezone,
        role: 'guide',
        onboarding_completed: false,
      },
    },
  })

  if (authError) {
    console.error('Signup error:', authError.message, authError.status)
    if (authError.message?.includes('already registered')) {
      return { error: 'An account with this email already exists.' }
    }
    return { error: `Could not create account: ${authError.message}` }
  }

  if (!authData.user) {
    return { error: 'Could not create account. Please try again.' }
  }

  // Create Player 1 (the guide is player 1)
  const playerResult = await createPlayerForGuide(
    authData.user.id,
    data.timezone,
    {
      username: data.username,
      password: data.password,
      first_name: data.firstName,
      last_name: data.lastName,
      isGuidePlayer: true,
    }
  )

  if (playerResult.error) {
    // Guide account exists but player creation failed.
    // User is authenticated, let them retry from the learners step.
    console.error('Player 1 creation failed after signup:', playerResult.error)
    return {
      error: 'Account created but player setup failed. You will be able to retry.',
      needsPlayerRetry: true,
    }
  }

  // Fire welcome email (don't block the response)
  sendWelcomeEmail({ email: data.email, firstName: data.firstName }).catch(() => {})

  redirect('/onboarding/players')
}
