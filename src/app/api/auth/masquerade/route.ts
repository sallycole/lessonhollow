import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

const MASQUERADE_COOKIE = 'masquerade'

/** POST /api/auth/masquerade — set masquerade cookie */
export async function POST(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get('player')

  if (!playerId) {
    return NextResponse.json({ error: 'Missing player parameter' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (user.user_metadata?.role === 'player') {
    return NextResponse.json({ error: 'Players cannot masquerade' }, { status: 403 })
  }

  const owns = await db.verifyGuideOwnsPlayer(user.id, playerId)
  if (!owns) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  const cookieStore = await cookies()
  cookieStore.set(MASQUERADE_COOKIE, playerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  return NextResponse.json({ ok: true })
}

/** DELETE /api/auth/masquerade — clear masquerade cookie */
export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(MASQUERADE_COOKIE)

  return NextResponse.json({ ok: true })
}
