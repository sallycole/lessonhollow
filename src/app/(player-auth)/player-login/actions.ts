'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type PlayerLoginState = {
  error?: string
}

export async function playerLogin(
  _prev: PlayerLoginState,
  formData: FormData
): Promise<PlayerLoginState> {
  const username = (formData.get('username') as string)?.trim()
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Please enter your username and password.' }
  }

  const { allowed, retryAfterMs } = checkRateLimit(`player-login:${username.toLowerCase()}`, 5, 60_000)
  if (!allowed) {
    const seconds = Math.ceil(retryAfterMs / 1000)
    return { error: `Whoa, too many tries! Wait ${seconds} seconds and try again.` }
  }

  // Look up the player by username (case-insensitive) to resolve the placeholder email
  const { data: player } = await db.getPlayerByUsernameCaseInsensitive(username)
  if (!player) {
    // Generic error — do not reveal whether the username exists
    return { error: "Hmm, that didn't work. Try your username and password again." }
  }

  // Construct the placeholder email from the stored username
  const placeholderEmail = `${player.username}@player.lessonhollow.local`

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: placeholderEmail,
    password,
  })

  if (error) {
    return { error: "Hmm, that didn't work. Try your username and password again." }
  }

  // Clear masquerade cookie on successful login
  const cookieStore = await cookies()
  cookieStore.delete('masquerade')

  redirect('/today')
}
