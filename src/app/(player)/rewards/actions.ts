'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getEffectiveUser, resolvePlayerContext } from '@/lib/masquerade'
import { createClient } from '@/lib/supabase/server'
import { ART_STYLES, MUSIC_GENRES } from '@/lib/styles'
import { generateLyrics as generateLyricsFromLLM, getRecentCompletedTaskTitles } from '@/lib/generate-lyrics'
import { generateMedia } from '@/lib/generate-media'
import { decryptPassword } from '@/lib/crypto'

export async function generateSong(
  artStyleName: string,
  genre: string
): Promise<{ error?: string }> {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) return { error: 'Not authenticated.' }

  const playerId = await resolvePlayerContext(effectiveUser)
  if (!playerId) return { error: 'No player found.' }

  // Resolve guide user ID for API key lookup
  const guideUserId = effectiveUser.isMasquerading
    ? effectiveUser.guideUserId!
    : (await getGuideUserIdForPlayer(playerId))

  if (!guideUserId) return { error: 'Could not determine guide account.' }

  // Check for fal.ai API key
  const { data: apiKeyRow } = await db.getUserApiKey(guideUserId, 'fal_ai')
  if (!apiKeyRow?.encrypted_key) {
    return { error: 'No fal.ai API key configured. Please add one in your Account settings.' }
  }

  // Decrypt the stored API key for use with fal.ai
  const falApiKey = decryptPassword(apiKeyRow.encrypted_key)

  // Resolve art style
  let artStylePrompt: string | undefined
  if (artStyleName) {
    const found = ART_STYLES.find((s) => s.name === artStyleName)
    artStylePrompt = found?.prompt
  } else {
    // Surprise Me — random style
    const random = ART_STYLES[Math.floor(Math.random() * ART_STYLES.length)]
    artStylePrompt = random.prompt
  }

  // Resolve genre
  const resolvedGenre = genre || MUSIC_GENRES[Math.floor(Math.random() * MUSIC_GENRES.length)]

  // Create initial speech record
  const { data: speech, error: createErr } = await db.createSpeech({
    player_id: playerId,
    title: 'Generating...',
    status: 'generating',
    model_used: 'gemini-2.5-flash + minimax-music-v2 + flux-pro-v1.1',
  })

  if (createErr || !speech) {
    return { error: 'Failed to create speech record.' }
  }

  // Generation pipeline (#80 generate-lyrics, #81 generate-media)
  try {
    // Get player name for personalization
    const { data: player } = await db.getPlayerById(playerId)
    const playerName = player?.first_name ?? 'Player'

    // Get recent task titles
    const recentTasks = await getRecentCompletedTaskTitles(
      playerId,
      player?.video_tasks_required ?? 1
    )

    // Generate lyrics
    const lyricsResult = await generateLyricsFromLLM(
      playerName,
      recentTasks,
      falApiKey,
      resolvedGenre
    )

    // Update speech with lyrics
    await db.updateSpeech(speech.id, {
      title: lyricsResult.title,
      speech_text: lyricsResult.lyrics,
      video_prompt: lyricsResult.imagePrompt,
    })

    // Generate media (audio + image in parallel via fal.ai)
    const mediaResult = await generateMedia(
      playerId,
      lyricsResult,
      falApiKey,
      artStylePrompt
    )

    // Update speech with media URLs
    const { error: finalUpdateErr } = await db.updateSpeech(speech.id, {
      audio_url: mediaResult.audioUrl,
      video_url: mediaResult.imageUrl,
      duration_seconds: mediaResult.durationSeconds ?? undefined,
      status: 'completed',
    })

    if (finalUpdateErr) {
      await db.deleteSpeech(speech.id)
      return { error: 'Reward was generated but failed to save. Please try again.' }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed.'

    // Check for fal.ai balance errors
    const isBalanceError =
      message.toLowerCase().includes('balance') ||
      message.toLowerCase().includes('credit') ||
      message.toLowerCase().includes('insufficient')

    await db.deleteSpeech(speech.id)

    if (isBalanceError) {
      return { error: 'fal.ai ran out of funds. Please add credits at fal.ai/dashboard/billing.' }
    }

    return { error: message }
  }

  revalidatePath('/rewards')
  return {}
}

async function getGuideUserIdForPlayer(playerId: string): Promise<string | null> {
  const { data: player } = await db.getPlayerById(playerId)
  if (!player?.guide_id) return null
  return player.guide_id
}

export async function updateTasksBetweenRewards(
  count: number
): Promise<{ error?: string; value?: number }> {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    return { error: 'Must be a whole number between 1 and 100.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }
  if (user.user_metadata?.role === 'player') return { error: 'Only guides can change this setting.' }

  // Save to guide's user_metadata
  const { error: metaError } = await supabase.auth.updateUser({
    data: { video_tasks_required: count },
  })
  if (metaError) return { error: 'Failed to update setting.' }

  // Propagate to all players under this guide
  await db.updatePlayersByGuide(user.id, { video_tasks_required: count })

  revalidatePath('/rewards')
  revalidatePath('/account')
  return { value: count }
}

export async function toggleShowRewards(): Promise<{ error?: string; enabled?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }
  if (user.user_metadata?.role === 'player') return { error: 'Only guides can change this setting.' }

  const current = user.user_metadata?.gorilla_enabled !== false
  const newValue = !current

  const { error } = await supabase.auth.updateUser({
    data: { gorilla_enabled: newValue },
  })

  if (error) return { error: 'Failed to update setting.' }

  revalidatePath('/', 'layout')
  return { enabled: newValue }
}
