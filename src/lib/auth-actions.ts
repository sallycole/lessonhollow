'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function logout() {
  const cookieStore = await cookies()

  // Clear masquerade cookie before signing out (REQ-011 safety)
  cookieStore.delete('masquerade')

  const supabase = await createClient()

  // Sign out — handles already-invalid sessions gracefully
  await supabase.auth.signOut()

  // Caller handles navigation via full page reload (window.location.href)
  // to ensure all client-side React state is cleanly reset.
}
