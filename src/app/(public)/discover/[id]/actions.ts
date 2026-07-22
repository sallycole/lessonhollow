'use server'

import { db } from '@/lib/db'
import { setMasquerade, getEffectiveUser } from '@/lib/masquerade'
import { createClient } from '@/lib/supabase/server'
import { sortPlayersGuideFirst } from '@/lib/sort-players'

const MODIFICATION_BUFFER_MS = 5_000

export type PickerPlayer = {
  id: string
  first_name: string
  last_name: string
  isGuidePlayer: boolean
}

export type SwitcherPlayer = {
  id: string
  first_name: string
  last_name: string
  isGuidePlayer: boolean
  hasCopy: boolean
  copyId?: string
}

export type SinglePlayerCopy =
  | { state: 'none' }
  | { state: 'unmodified'; copyId: string; copyName: string }
  | { state: 'modified'; copyId: string; copyName: string }

export type LandingContext =
  | { mode: 'unauthenticated' }
  | { mode: 'no-players' }
  | { mode: 'first-time-picker'; players: PickerPlayer[] }
  | { mode: 'guide-switcher'; players: SwitcherPlayer[] }
  | {
      mode: 'single-player'
      player: { id: string; first_name: string }
      copy: SinglePlayerCopy
    }

export type LandingContextResult = {
  context?: LandingContext
  error?: string
}

export type AdoptResult = {
  results?: { playerId: string; playerName: string; curriculumId: string }[]
  error?: string
}

export type SinglePlayerAdoptResult = {
  curriculumId?: string
  error?: string
}

/**
 * Check whether a copied curriculum has been modified since adoption.
 * Modified if metadata changed, task count differs from source, or any task
 * has been edited.
 */
async function isCopyModified(
  copyId: string,
  sourceTaskCount: number
): Promise<boolean> {
  const { data: c } = await db.getCurriculumById(copyId)
  if (!c) return false

  const createdMs = new Date(c.created_at).getTime()
  const updatedMs = new Date(c.updated_at).getTime()
  if (updatedMs - createdMs > MODIFICATION_BUFFER_MS) return true

  const { data: tasks } = await db.getTasksByCurriculum(copyId)
  const taskList = tasks ?? []
  if (taskList.length !== sourceTaskCount) return true

  for (const t of taskList) {
    if (!t.created_at || !t.updated_at) continue
    const tc = new Date(t.created_at).getTime()
    const tu = new Date(t.updated_at).getTime()
    if (tu - tc > MODIFICATION_BUFFER_MS) return true
  }
  return false
}

/**
 * Returns the right rendering mode for the AdoptCta based on the auth context
 * and what the guide's players have already adopted.
 */
export async function getLandingContextAction(
  sourceCurriculumId: string
): Promise<LandingContextResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { context: { mode: 'unauthenticated' } }
  }

  const role = user.user_metadata?.role as string | undefined
  const effective = await getEffectiveUser()
  if (!effective) {
    return { context: { mode: 'unauthenticated' } }
  }

  // Verify the source curriculum exists and is public.
  const { data: source } = await db.getCurriculumById(sourceCurriculumId)
  if (!source || !source.is_public) {
    return { error: 'This curriculum is no longer available.' }
  }
  const sourceTaskCount = await db.getTaskCountByCurriculum(sourceCurriculumId)

  // Player or masquerading guide -> single-player mode
  if (role === 'player' || effective.isMasquerading) {
    let playerId: string
    let playerName: string
    if (effective.isMasquerading && effective.playerId) {
      const { data: player } = await db.getPlayerById(effective.playerId)
      if (!player) {
        return { context: { mode: 'unauthenticated' } }
      }
      playerId = player.id
      playerName = player.first_name
    } else {
      const player = await db.verifyPlayerIdentity(effective.userId)
      if (!player) {
        return { context: { mode: 'unauthenticated' } }
      }
      playerId = player.id
      playerName = player.first_name
    }

    const { data: copy } = await db.getCopyByOriginalIdAndUser(
      sourceCurriculumId,
      effective.userId
    )

    if (!copy) {
      return {
        context: {
          mode: 'single-player',
          player: { id: playerId, first_name: playerName },
          copy: { state: 'none' },
        },
      }
    }

    const modified = await isCopyModified(copy.id, sourceTaskCount)

    return {
      context: {
        mode: 'single-player',
        player: { id: playerId, first_name: playerName },
        copy: {
          state: modified ? 'modified' : 'unmodified',
          copyId: copy.id,
          copyName: copy.name,
        },
      },
    }
  }

  // Guide, not masquerading
  if (role !== 'guide') {
    return { context: { mode: 'unauthenticated' } }
  }

  const { data: players } = await db.getPlayersByGuide(user.id)
  if (!players || players.length === 0) {
    return { context: { mode: 'no-players' } }
  }

  // Sort players: guide-as-player first, then alphabetical by first name
  const { sorted } = sortPlayersGuideFirst(players)

  // Check each player for an existing copy (in sorted order so the result is
  // already in display order).
  const switcherPlayers: SwitcherPlayer[] = []
  for (const p of sorted) {
    const isGuidePlayer = p.is_guide_player === true
    if (!p.auth_user_id) {
      switcherPlayers.push({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        isGuidePlayer,
        hasCopy: false,
      })
      continue
    }
    const { data: copy } = await db.getCopyByOriginalIdAndUser(
      sourceCurriculumId,
      p.auth_user_id
    )
    switcherPlayers.push({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      isGuidePlayer,
      hasCopy: !!copy,
      copyId: copy?.id,
    })
  }

  const anyAdopted = switcherPlayers.some((p) => p.hasCopy)

  if (!anyAdopted) {
    return {
      context: {
        mode: 'first-time-picker',
        players: switcherPlayers.map((p) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          isGuidePlayer: p.isGuidePlayer,
        })),
      },
    }
  }

  return {
    context: {
      mode: 'guide-switcher',
      players: switcherPlayers,
    },
  }
}

/**
 * First-time multi-player adoption. Guarded so it only runs when no player
 * has adopted yet — defends against stale UI state.
 */
export async function adoptForGuideFirstTimeAction(
  sourceCurriculumId: string,
  playerIds: string[]
): Promise<AdoptResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be logged in.' }
  }
  if (user.user_metadata?.role !== 'guide') {
    return { error: 'Only guides can use the multi-player picker.' }
  }
  if (playerIds.length === 0) {
    return { error: 'Select at least one player.' }
  }

  // Re-verify that none of this guide's players already have a copy
  const { data: allPlayers } = await db.getPlayersByGuide(user.id)
  for (const p of allPlayers ?? []) {
    if (!p.auth_user_id) continue
    const { data: existing } = await db.getCopyByOriginalIdAndUser(
      sourceCurriculumId,
      p.auth_user_id
    )
    if (existing) {
      return {
        error: 'Someone in your account already has this curriculum. Please refresh.',
      }
    }
  }

  const results: AdoptResult['results'] = []

  for (const playerId of playerIds) {
    const owns = await db.verifyGuideOwnsPlayer(user.id, playerId)
    if (!owns) continue

    const { data: player } = await db.getPlayerById(playerId)
    if (!player?.auth_user_id) continue

    const { data, error } = await db.adoptPublicCurriculum(
      sourceCurriculumId,
      player.auth_user_id
    )

    if (!error && data) {
      results.push({
        playerId,
        playerName: player.first_name,
        curriculumId: data.id,
      })
    }
  }

  if (results.length === 0) {
    return { error: 'Failed to copy curriculum for any player.' }
  }

  await setMasquerade(results[0].playerId)

  return { results }
}

/**
 * Single-player adoption from the player's own seat. Used in single-player
 * mode for both fresh adoptions and "fresh copy" creation alongside an
 * existing modified copy.
 */
export async function adoptForCurrentPlayerAction(
  sourceCurriculumId: string,
  opts?: { copyName?: string }
): Promise<SinglePlayerAdoptResult> {
  const effective = await getEffectiveUser()
  if (!effective) {
    return { error: 'You must be logged in.' }
  }

  // The acting user must be a player or a masquerading guide.
  // Guides operating in their own seat use the multi-player picker instead.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role as string | undefined
  if (role === 'guide' && !effective.isMasquerading) {
    return { error: 'Switch to a player first.' }
  }

  // If the player already has a copy and no name override was supplied, refuse.
  // The UI should never send this request — defense in depth.
  const { data: existing } = await db.getCopyByOriginalIdAndUser(
    sourceCurriculumId,
    effective.userId
  )
  if (existing && !opts?.copyName) {
    return { error: 'You already have this curriculum.' }
  }

  const { data, error } = await db.adoptPublicCurriculum(
    sourceCurriculumId,
    effective.userId,
    opts?.copyName
  )

  if (error || !data) {
    return { error: error || 'Failed to copy curriculum.' }
  }

  return { curriculumId: data.id }
}
