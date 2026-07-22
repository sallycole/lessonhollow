import { createClient } from '@/lib/supabase/server'
import { getMasqueradeContext } from '@/lib/masquerade'
import { db } from '@/lib/db'
import { sortPlayersGuideFirst } from '@/lib/sort-players'
import { playerNav, guideNav, type NavItem } from '@/lib/navigation'
import type { SwitcherPlayer } from '@/components/chrome/pico-view-switcher'

export type ChromeSession = {
  isLoggedIn: boolean
  /** Player view: direct player login OR guide masquerading as a player */
  isPlayerView: boolean
  /** Guide context — used to enable view switcher, dashboard nav */
  isGuide: boolean
  masquerade: { playerId: string; playerName: string } | null
  players: SwitcherPlayer[]
  playerName?: string
  /** Tabs to render in the secondary nav. Empty array = don't render the tabs strip. */
  navItems: NavItem[]
  /** Where the LH wordmark should link to */
  logoHref: string
}

const EMPTY: ChromeSession = {
  isLoggedIn: false,
  isPlayerView: false,
  isGuide: false,
  masquerade: null,
  players: [],
  navItems: [],
  logoHref: '/',
}

export async function getChromeSession(): Promise<ChromeSession> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return EMPTY
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return EMPTY

    const role = user.user_metadata?.role as string | undefined
    const isPlayer = role === 'player'

    let masquerade: { playerId: string; playerName: string } | null = null
    let rewardsEnabled = true
    let players: SwitcherPlayer[] = []
    let playerName: string | undefined

    if (!isPlayer) {
      masquerade = await getMasqueradeContext()
      rewardsEnabled = user.user_metadata?.gorilla_enabled !== false
      try {
        const { data } = await db.getPlayersByGuide(user.id)
        const { sorted } = sortPlayersGuideFirst(data ?? [])
        players = sorted.map((p) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          isGuidePlayer: p.is_guide_player === true,
        }))
      } catch {
        players = []
      }
    } else {
      try {
        const { data: player } = await db.getPlayerByAuthUserId(user.id)
        if (player) {
          playerName = player.first_name
          if (player.guide_id) {
            const { createAdminClient } = await import('@/lib/supabase/admin')
            const admin = createAdminClient()
            const { data: guideData } = await admin.auth.admin.getUserById(player.guide_id)
            rewardsEnabled = guideData?.user?.user_metadata?.gorilla_enabled !== false
          }
        }
      } catch {
        // fall back to no name; rewardsEnabled stays true
      }
    }

    const isPlayerView = isPlayer || !!masquerade
    const baseNavItems = isPlayerView ? playerNav : guideNav
    const navItems =
      isPlayerView && !rewardsEnabled
        ? baseNavItems.filter((item) => item.href !== '/rewards')
        : [...baseNavItems]

    const logoHref = isPlayerView ? '/today' : '/dashboard'

    return {
      isLoggedIn: true,
      isPlayerView,
      isGuide: !isPlayer,
      masquerade,
      players,
      playerName,
      navItems,
      logoHref,
    }
  } catch {
    return EMPTY
  }
}
