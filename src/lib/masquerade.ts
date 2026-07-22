'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

const MASQUERADE_COOKIE = 'masquerade'

export type MasqueradeContext = {
  playerId: string
  playerName: string
} | null

/**
 * Set masquerade cookie for a guide to view as a player.
 * Validates guide auth and ownership of the player.
 * Does NOT redirect — caller handles navigation.
 */
export async function setMasquerade(playerId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.warn('[masquerade:reject] unauthenticated attempt', { playerId, timestamp: new Date().toISOString() })
    return { error: 'Not authenticated.' }
  }

  if (user.user_metadata?.role === 'player') {
    console.warn('[masquerade:reject] player attempted masquerade', { userId: user.id, playerId, timestamp: new Date().toISOString() })
    return { error: 'Players cannot masquerade.' }
  }

  const owns = await db.verifyGuideOwnsPlayer(user.id, playerId)
  if (!owns) {
    console.warn('[masquerade:reject] guide does not own player', { guideId: user.id, playerId, timestamp: new Date().toISOString() })
    return { error: 'Player not found.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(MASQUERADE_COOKIE, playerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  })

  console.info('[masquerade:start]', { guideId: user.id, playerId, timestamp: new Date().toISOString() })
  revalidatePath('/', 'layout')
  return {}
}

/**
 * Read the masquerade cookie and return player context.
 * If the cookie references a deleted player, clears it and returns null.
 */
export async function getMasqueradeContext(): Promise<MasqueradeContext> {
  const cookieStore = await cookies()
  const playerId = cookieStore.get(MASQUERADE_COOKIE)?.value

  if (!playerId) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Stale cookie — ignore it. Can't delete cookies during server component
    // render; logout() and middleware handle proper cleanup.
    return null
  }

  const owns = await db.verifyGuideOwnsPlayer(user.id, playerId)
  if (!owns) {
    return null
  }

  const { data: player } = await db.getPlayerById(playerId)
  if (!player) {
    return null
  }

  return {
    playerId: player.id,
    playerName: `${player.first_name} ${player.last_name}`,
  }
}

/**
 * Clear the masquerade cookie (exit masquerade mode).
 * Does NOT redirect — caller handles navigation.
 */
export async function clearMasquerade(): Promise<void> {
  const cookieStore = await cookies()
  const playerId = cookieStore.get(MASQUERADE_COOKIE)?.value

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  console.info('[masquerade:stop]', { guideId: user?.id ?? 'unknown', playerId: playerId ?? 'none', timestamp: new Date().toISOString() })
  cookieStore.delete(MASQUERADE_COOKIE)
  revalidatePath('/', 'layout')
}

/**
 * Effective user context for data queries.
 * When masquerading: userId is the player's auth_user_id (for scoping curricula, enrollments, etc.)
 * When not masquerading: userId is the guide's or player's own auth user ID.
 */
export type EffectiveUser = {
  /** The user ID to use for data queries (player's auth_user_id when masquerading) */
  userId: string
  /** Whether the current session is masquerading */
  isMasquerading: boolean
  /** The guide's own auth user ID (set only when masquerading) */
  guideUserId?: string
  /** The player record ID (set only when masquerading) */
  playerId?: string
  /** The player's display name (set only when masquerading) */
  playerName?: string
}

/**
 * Get the effective user for data queries.
 * Resolves the masquerade context so downstream features can scope data to the right user.
 *
 * Usage in server components / server actions:
 *   const effectiveUser = await getEffectiveUser()
 *   if (!effectiveUser) redirect('/login')
 *   const curricula = await db.getCurriculaByUser(effectiveUser.userId)
 *
 * Returns null if the user is not authenticated.
 */
export async function getEffectiveUser(): Promise<EffectiveUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const role = user.user_metadata?.role as string | undefined

  // Players always use their own user ID — no masquerade possible
  if (role === 'player') {
    return { userId: user.id, isMasquerading: false }
  }

  // Guide: check for active masquerade
  const masquerade = await getMasqueradeContext()
  if (!masquerade) {
    return { userId: user.id, isMasquerading: false }
  }

  // Resolve the player's auth_user_id for data queries
  const { data: player } = await db.getPlayerById(masquerade.playerId)
  if (!player?.auth_user_id) {
    // Player was deleted or has no auth user — clear stale masquerade
    const cookieStore = await cookies()
    cookieStore.delete(MASQUERADE_COOKIE)
    return { userId: user.id, isMasquerading: false }
  }

  return {
    userId: player.auth_user_id,
    isMasquerading: true,
    guideUserId: user.id,
    playerId: masquerade.playerId,
    playerName: masquerade.playerName,
  }
}

/**
 * Resolve the player ID from an EffectiveUser context.
 * Centralizes the pattern of resolving player ID from masquerade or direct login.
 * Returns null if no player account is found.
 */
export async function resolvePlayerContext(
  effectiveUser: EffectiveUser
): Promise<string | null> {
  if (effectiveUser.isMasquerading && effectiveUser.playerId) {
    return effectiveUser.playerId
  }
  const player = await db.verifyPlayerIdentity(effectiveUser.userId)
  return player?.id ?? null
}
