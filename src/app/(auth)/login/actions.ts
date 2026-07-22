'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type LoginState = {
  error?: string
  emailNotConfirmed?: boolean
}

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const identifier = ((formData.get('identifier') ?? formData.get('email')) as string)?.trim()
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string

  if (!identifier || !password) {
    return { error: 'Email/username and password are required.' }
  }

  const isEmail = identifier.includes('@')

  if (!isEmail) {
    // Player login via username
    const { allowed, retryAfterMs } = checkRateLimit(`player-login:${identifier.toLowerCase()}`, 5, 60_000)
    if (!allowed) {
      const seconds = Math.ceil(retryAfterMs / 1000)
      return { error: `Too many attempts. Please try again in ${seconds} seconds.` }
    }

    const { data: player } = await db.getPlayerByUsernameCaseInsensitive(identifier)
    if (!player) {
      return { error: "Hmm, that didn't work. Check your username and password and try again." }
    }

    const placeholderEmail = `${player.username}@player.lessonhollow.local`
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: placeholderEmail,
      password,
    })

    if (error) {
      return { error: "Hmm, that didn't work. Check your username and password and try again." }
    }

    const cookieStore = await cookies()
    cookieStore.delete('masquerade')

    redirect(redirectTo || '/today')
  }

  // Guide login via email
  const { allowed, retryAfterMs } = checkRateLimit(`login:${identifier}`, 5, 60_000)
  if (!allowed) {
    const seconds = Math.ceil(retryAfterMs / 1000)
    return { error: `Too many attempts. Please try again in ${seconds} seconds.` }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: identifier,
    password,
  })

  if (error) {
    if (error.message?.toLowerCase().includes('email not confirmed')) {
      return {
        error: 'Your email has not been confirmed. Check your inbox for the confirmation link.',
        emailNotConfirmed: true,
      }
    }
    return { error: 'Invalid email or password.' }
  }

  // Clear masquerade cookie on successful login
  const cookieStore = await cookies()
  cookieStore.delete('masquerade')

  // Determine redirect based on role
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role

  if (role === 'player') {
    redirect(redirectTo || '/today')
  }

  redirect(redirectTo || '/dashboard')
}

export async function resendConfirmation(email: string): Promise<LoginState> {
  if (!email) {
    return { error: 'Email is required to resend confirmation.' }
  }

  const { allowed, retryAfterMs } = checkRateLimit(`confirm:${email}`, 3, 60_000)
  if (!allowed) {
    const seconds = Math.ceil(retryAfterMs / 1000)
    return { error: `Too many attempts. Please try again in ${seconds} seconds.` }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  })

  if (error) {
    return { error: 'Could not resend confirmation. Please try again.' }
  }

  return {}
}
