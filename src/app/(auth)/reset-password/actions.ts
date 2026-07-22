'use server'

import { createClient } from '@/lib/supabase/server'

export type ResetPasswordState = {
  error?: string
  success?: boolean
}

export async function updatePassword(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || !confirmPassword) {
    return { error: 'Both password fields are required.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    if (error.message.includes('same')) {
      return { error: 'New password must be different from your current password.' }
    }
    return { error: 'Unable to update password. Please try again.' }
  }

  return { success: true }
}
