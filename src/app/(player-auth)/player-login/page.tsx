import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { PlayerLoginForm } from './player-login-form'

export const dynamic = 'force-dynamic'

async function getLoggedInPlayer() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return false
  }

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const role = user.user_metadata?.role as string | undefined
    return role === 'player'
  } catch {
    return false
  }
}

export default async function PlayerLoginPage() {
  const isPlayer = await getLoggedInPlayer()
  if (isPlayer) redirect('/today')

  return (
    <div className="player-login-shell">
      <hgroup className="player-login-header">
        <h2>Ready to learn today?</h2>
      </hgroup>
      <Suspense>
        <PlayerLoginForm />
      </Suspense>
    </div>
  )
}
