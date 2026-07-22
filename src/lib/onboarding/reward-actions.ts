'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { decryptPassword } from '@/lib/crypto'
import { ART_STYLES, MUSIC_GENRES } from '@/lib/styles'
import { generateLyrics } from '@/lib/generate-lyrics'
import { generateMedia } from '@/lib/generate-media'

/**
 * Simplified reward generation for onboarding.
 * Bypasses credit checks (first-time experience) and works
 * with an explicit playerId rather than masquerade context.
 */
export async function generateOnboardingReward(
  playerId: string,
  artStyleName: string,
  genre: string,
): Promise<{ error?: string; imageUrl?: string; audioUrl?: string; title?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Verify guide owns this player
  const { data: player } = await db.getPlayerById(playerId)
  if (!player || player.guide_id !== user.id) {
    return { error: 'Player not found.' }
  }

  // Get fal.ai key
  const { data: apiKeyRow } = await db.getUserApiKey(user.id, 'fal_ai')
  if (!apiKeyRow?.encrypted_key) {
    return { error: 'No fal.ai API key configured.' }
  }
  const falApiKey = decryptPassword(apiKeyRow.encrypted_key)

  // Resolve style and genre
  const artStyle = artStyleName
    ? ART_STYLES.find((s) => s.name === artStyleName)
    : ART_STYLES[Math.floor(Math.random() * ART_STYLES.length)]
  const resolvedGenre = genre || MUSIC_GENRES[Math.floor(Math.random() * MUSIC_GENRES.length)]

  // Create speech record
  const { data: speech, error: createErr } = await db.createSpeech({
    player_id: playerId,
    title: 'Generating...',
    status: 'generating',
    model_used: 'gemini-2.5-flash + minimax-music-v2 + flux-pro-v1.1',
  })

  if (createErr || !speech) {
    return { error: 'Failed to start generation.' }
  }

  try {
    const playerName = player.first_name ?? 'Player'

    // For onboarding, there are no completed tasks yet so use placeholder topics
    const sampleTopics = ['getting started', 'first day of learning', 'a new adventure begins']

    const lyricsResult = await generateLyrics(
      playerName,
      sampleTopics,
      falApiKey,
      resolvedGenre,
    )

    await db.updateSpeech(speech.id, {
      title: lyricsResult.title,
      speech_text: lyricsResult.lyrics,
      video_prompt: lyricsResult.imagePrompt,
    })

    const mediaResult = await generateMedia(
      playerId,
      lyricsResult,
      falApiKey,
      artStyle?.prompt,
    )

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

    return {
      imageUrl: mediaResult.imageUrl,
      audioUrl: mediaResult.audioUrl,
      title: lyricsResult.title,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed.'
    await db.deleteSpeech(speech.id)

    if (message.toLowerCase().includes('balance') || message.toLowerCase().includes('insufficient')) {
      return { error: 'fal.ai ran out of funds. Please add credits at fal.ai/dashboard/billing.' }
    }

    return { error: message }
  }
}
