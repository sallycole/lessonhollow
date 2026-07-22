import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/** POST /api/auth/logout — sign out and clear cookies */
export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete('masquerade')

  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
