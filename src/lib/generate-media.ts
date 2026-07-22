import { createAdminClient } from './supabase/admin'
import type { LyricsResult } from './generate-lyrics'

export type MediaResult = {
  audioUrl: string
  imageUrl: string
  durationSeconds: number | null
}

/**
 * Generates song audio (MiniMax Music 2.0) and reward image (Flux Schnell)
 * in parallel via fal.ai, then uploads both to Supabase Storage.
 */
export async function generateMedia(
  studentId: string,
  lyricsResult: LyricsResult,
  credentials: string,
  artStylePrompt?: string
): Promise<MediaResult> {
  const timestamp = Date.now()

  // Build image prompt: art style PREPENDED (models weight earlier tokens more)
  const imagePrompt = artStylePrompt
    ? `${artStylePrompt}. ${lyricsResult.imagePrompt}. Keep key visuals inside a square-safe zone in the center.`
    : `${lyricsResult.imagePrompt}. Keep key visuals inside a square-safe zone in the center.`

  // Generate audio and image in parallel
  const [audioResult, imageResult] = await Promise.all([
    generateAudio(credentials, lyricsResult.songStyle, lyricsResult.lyrics),
    generateImage(credentials, imagePrompt),
  ])

  // Upload both to Supabase Storage in parallel
  const [audioUrl, imageUrl] = await Promise.all([
    uploadToStorage(
      audioResult.url,
      `${studentId}/${timestamp}.mp3`,
      'audio/mpeg'
    ),
    uploadToStorage(
      imageResult.url,
      `${studentId}/${timestamp}.webp`,
      'image/webp'
    ),
  ])

  return {
    audioUrl,
    imageUrl,
    durationSeconds: audioResult.durationSeconds,
  }
}

/**
 * Submit a request to fal.ai queue, poll for completion, return the result.
 * Uses raw fetch instead of the SDK to avoid auth issues with queue polling.
 */
async function falQueueRequest(
  credentials: string,
  model: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Key ${credentials}`,
  }

  // Submit to queue
  const submitRes = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })

  if (!submitRes.ok) {
    const body = await submitRes.text().catch(() => '')
    throw new Error(`fal.ai submit failed (${submitRes.status}): ${body}`)
  }

  const submitData = await submitRes.json() as {
    request_id: string
    status: string
    response_url: string
    status_url: string
  }

  // If completed immediately
  if (submitData.status === 'COMPLETED') {
    const resultRes = await fetch(submitData.response_url, { headers })
    if (!resultRes.ok) throw new Error(`fal.ai result fetch failed (${resultRes.status})`)
    return resultRes.json()
  }

  // Poll for completion
  const maxAttempts = 120 // 2 minutes at 1s intervals
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000))

    const statusRes = await fetch(submitData.status_url, { headers })
    if (!statusRes.ok) {
      throw new Error(`fal.ai status poll failed (${statusRes.status})`)
    }

    const statusData = await statusRes.json() as { status: string }

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(submitData.response_url, { headers })
      if (!resultRes.ok) throw new Error(`fal.ai result fetch failed (${resultRes.status})`)
      return resultRes.json()
    }

    if (statusData.status === 'FAILED') {
      throw new Error('fal.ai generation failed')
    }
  }

  throw new Error('fal.ai generation timed out after 2 minutes')
}

async function generateAudio(
  credentials: string,
  songStyle: string,
  lyrics: string
): Promise<{ url: string; durationSeconds: number | null }> {
  try {
    const data = await falQueueRequest(credentials, 'fal-ai/minimax-music/v2', {
      prompt: songStyle,
      lyrics_prompt: lyrics,
    }) as { audio: { url: string }; duration?: number }

    if (!data?.audio?.url) {
      throw new Error('No audio URL in response')
    }

    return {
      url: data.audio.url,
      durationSeconds: data.duration ?? null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Audio generation failed: ${message}`)
  }
}

async function generateImage(
  credentials: string,
  prompt: string
): Promise<{ url: string }> {
  try {
    const data = await falQueueRequest(credentials, 'fal-ai/flux-pro/v1.1', {
      prompt,
      image_size: 'portrait_16_9',
    }) as { images: Array<{ url: string }> }

    if (!data?.images?.[0]?.url) {
      throw new Error('No image URL in response')
    }

    return { url: data.images[0].url }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Image generation failed: ${message}`)
  }
}

/**
 * Fetches a fal.ai output URL and uploads it to Supabase Storage,
 * returning a signed URL valid for 365 days.
 */
async function uploadToStorage(
  sourceUrl: string,
  path: string,
  contentType: string
): Promise<string> {
  const supabase = createAdminClient()

  // Fetch the file from fal.ai
  let fileBuffer: ArrayBuffer
  try {
    const response = await fetch(sourceUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch (${response.status})`)
    }
    fileBuffer = await response.arrayBuffer()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const type = contentType.startsWith('audio') ? 'Audio' : 'Image'
    throw new Error(`${type} upload failed: could not fetch source: ${message}`)
  }

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('fox-songs')
    .upload(path, fileBuffer, {
      upsert: true,
      contentType,
    })

  if (uploadError) {
    const type = contentType.startsWith('audio') ? 'Audio' : 'Image'
    throw new Error(`${type} upload failed: ${uploadError.message}`)
  }

  // Create signed URL valid for 365 days
  const { data: signedData, error: signedError } = await supabase.storage
    .from('fox-songs')
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  if (signedError || !signedData?.signedUrl) {
    const type = contentType.startsWith('audio') ? 'Audio' : 'Image'
    throw new Error(`${type} upload failed: could not create signed URL`)
  }

  return signedData.signedUrl
}
