import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { checkApiRateLimit } from '@/lib/rate-limit'
import { sortPlayersGuideFirst } from '@/lib/sort-players'

export async function GET() {
  try {
    const { user, response } = await requireAuth()
    if (response) return response

    // General API: 100 requests per user per minute
    const rateLimited = checkApiRateLimit(user.id, 'players')
    if (rateLimited) return rateLimited

    if (user.user_metadata?.role === 'player') {
      return NextResponse.json({ error: 'Players cannot list players' }, { status: 403 })
    }

    const { data, error } = await db.getPlayersByGuide(user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to load players' }, { status: 500 })
    }

    const { sorted } = sortPlayersGuideFirst(data ?? [])

    // Return only the fields needed by the player picker, with the guide-self
    // flag so the menu can label that one as "Your Player View".
    const players = sorted.map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      isGuidePlayer: p.is_guide_player === true,
    }))

    return NextResponse.json({ players })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
