import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { MAX_PLAYERS_PER_GUIDE } from '@/lib/constants'
import { PlayersClient, type PlayerWithDetails } from './players-client'

export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  let players: PlayerWithDetails[] = []

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user && user.user_metadata?.role !== 'player') {
      const { data: rawPlayers } = await db.getPlayersByGuide(user.id)

      if (rawPlayers) {
        players = await Promise.all(
          rawPlayers.map(async (p) => {
            let enrollmentCount = 0
            try {
              const { count } = await db.getActiveEnrollmentCountByPlayer(p.id)
              enrollmentCount = count ?? 0
            } catch {
              // Enrollments table might not exist yet
            }

            return {
              id: p.id,
              username: p.username,
              first_name: p.first_name,
              last_name: p.last_name,
              time_zone: p.time_zone,
              active_enrollment_count: enrollmentCount,
              is_guide_player: p.is_guide_player === true,
              password_set_by_user: p.player_password_set_at != null,
            }
          })
        )
      }
    }
  } catch {
    // Supabase not configured — show empty state
  }

  return <PlayersClient players={players} isAtPlayerLimit={players.length >= MAX_PLAYERS_PER_GUIDE} />
}
