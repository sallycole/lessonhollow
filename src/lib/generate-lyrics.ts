import { db } from '@/lib/db'
import { MUSIC_GENRES } from '@/lib/styles'

export type LyricsResult = {
  title: string
  lyrics: string
  imagePrompt: string
  songStyle: string
}

/**
 * Fetches the N most recently completed task titles (from both player_tasks and
 * spontaneous_entries), merged by recency.
 */
export async function getRecentCompletedTaskTitles(
  playerId: string,
  tasksRequired: number
): Promise<string[]> {
  // Get enrollment IDs for this player
  const { data: enrollments } = await db.getEnrollmentsByPlayer(playerId)
  const enrollmentIds = (enrollments ?? []).map((e) => e.id)

  // Query both sources in parallel
  const [taskResult, spontResult] = await Promise.all([
    enrollmentIds.length > 0
      ? db.getRecentCompletedPlayerTasks(enrollmentIds, tasksRequired)
      : Promise.resolve({ data: [] }),
    db.getRecentSpontaneousEntries(playerId, tasksRequired),
  ])

  type TaskRow = { completed_at: string; label: string }

  // Normalize player_tasks: join through tasks(title, description)
  // Supabase returns tasks as an array from the join
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskRows: TaskRow[] = (taskResult.data ?? []).map((row: any) => {
    const t = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks
    if (!t) return { completed_at: row.completed_at, label: 'Unknown task' }
    const label = t.description ? `${t.title} - ${t.description}` : t.title
    return { completed_at: row.completed_at, label }
  })

  // Normalize spontaneous_entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spontRows: TaskRow[] = (spontResult.data ?? []).map((row: any) => {
    const label = row.description ? `${row.title} - ${row.description}` : row.title
    return { completed_at: row.created_at, label }
  })

  // Merge by recency and cap at N
  const merged = [...taskRows, ...spontRows]
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    .slice(0, tasksRequired)

  if (merged.length > 0) {
    return merged.map((r) => r.label)
  }

  // No completed tasks — fall back to upcoming curriculum task titles for context
  if (enrollmentIds.length > 0) {
    const { data: enrollments } = await db.getEnrollmentsByPlayer(playerId)
    const curriculumIds = (enrollments ?? [])
      .map((e) => (e as { curriculum_id: string }).curriculum_id)
      .filter(Boolean)

    const titles: string[] = []
    for (const currId of curriculumIds.slice(0, 3)) {
      const { data: tasks } = await db.getTasksByCurriculum(currId)
      for (const t of (tasks ?? []).slice(0, 5) as Array<{ title: string; description?: string }>) {
        titles.push(t.description ? `${t.title} - ${t.description}` : t.title)
      }
    }
    if (titles.length > 0) return titles.slice(0, 10)
  }

  return []
}

const SYSTEM_PROMPT = `You are a creative songwriter who creates personalized reward songs for kids who completed their schoolwork.

RULES:
- The player's first name MUST appear at least once in the chorus
- Every keyword from their schoolwork must be transformed into a surreal, dream-sequence image — never used literally
- Song structure: [Verse], [Chorus], [Verse] — approximately 75–100 words total
- Tone is family-friendly, joyful, "weird in a good way"
- Title: 2–5 words, like a real song title, hints at the surreal theme — NOT "Reward for [Name]"

OUTPUT FORMAT — respond with a single JSON object, no markdown fences:
{
  "title": "2-5 word song title",
  "lyrics": "full lyrics with [Verse] and [Chorus] tags",
  "imagePrompt": "a whimsical scene description pulling visual themes from the surreal lyrics — describe the SCENE and CHARACTERS only, do NOT include any art style, medium, or rendering terms",
  "songStyle": "musical style descriptors (upbeat, celebratory, etc.) — do NOT include the genre, it will be prepended automatically"
}

IMAGE PROMPT RULES:
- Pull visual themes from the surreal lyrics
- Describe the SCENE and CHARACTERS only
- Do NOT include any art style, medium, or rendering terms (no "digital art", "watercolor", "painting", etc.)
- Art style is handled separately`

/**
 * Calls an LLM via fal.ai to generate personalized song lyrics, an image prompt,
 * a song style, and a title.
 */
export async function generateLyrics(
  studentName: string,
  recentTasks: string[],
  credentials: string,
  genre?: string
): Promise<LyricsResult> {
  // Resolve genre
  const resolvedGenre =
    genre || MUSIC_GENRES[Math.floor(Math.random() * MUSIC_GENRES.length)]

  // Build user prompt
  let userPrompt: string
  if (recentTasks.length === 0) {
    userPrompt = `Player name: ${studentName}\nThis is ${studentName}'s very first reward for joining Lesson Hollow! Use these themes as inspiration: the excitement of starting a new learning adventure, following your curiosity wherever it leads, discovering what you're passionate about, building your own path, and the joy of learning because you want to. Make it feel like a celebration of beginning something great.`
  } else {
    const taskList = recentTasks.slice(0, 10).join(', ')
    userPrompt = `Player name: ${studentName}\nKeywords from recent schoolwork: ${taskList}`
  }

  const systemPrompt = `${SYSTEM_PROMPT}\n\nThe selected music genre is: ${resolvedGenre}. Tailor the song style and energy to match this genre.`

  // Call fal.ai any-llm endpoint
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  let response: Response
  try {
    response = await fetch('https://fal.run/fal-ai/any-llm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${credentials}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        prompt: userPrompt,
        system_prompt: systemPrompt,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Lyrics generation timed out (15s). Please try again.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`fal.ai lyrics generation failed (${response.status}): ${body}`)
  }

  const data = await response.json()
  const output: string = data.output ?? data.result ?? ''

  if (!output) {
    throw new Error('fal.ai returned empty output for lyrics generation.')
  }

  // Extract JSON from the LLM response (find first {...} block)
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse lyrics from LLM response.')
  }

  let parsed: { title?: string; lyrics?: string; imagePrompt?: string; songStyle?: string }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('Could not parse lyrics JSON from LLM response.')
  }

  const lyrics = parsed.lyrics ?? ''
  const title = parsed.title ?? ''
  const imagePrompt = parsed.imagePrompt ?? ''

  // Validate lyrics length
  if (lyrics.length < 10 || lyrics.length > 3000) {
    throw new Error(
      `Generated lyrics are ${lyrics.length} characters (expected 10–3000). Generation failed.`
    )
  }

  // Name guarantee: if name is missing from lyrics, prepend to chorus
  let finalLyrics = lyrics
  if (!finalLyrics.toLowerCase().includes(studentName.toLowerCase())) {
    finalLyrics = finalLyrics.replace(
      /\[Chorus\]\n?/i,
      `[Chorus]\nHey ${studentName}, `
    )
    // If no [Chorus] tag was found, prepend at start
    if (!finalLyrics.toLowerCase().includes(studentName.toLowerCase())) {
      finalLyrics = `Hey ${studentName}, ` + finalLyrics
    }
  }

  // Structure tag guarantee
  if (!/\[Verse\]/i.test(finalLyrics)) {
    finalLyrics = `[Verse]\n${finalLyrics}`
  }
  if (!/\[Chorus\]/i.test(finalLyrics)) {
    // Insert [Chorus] roughly in the middle
    const lines = finalLyrics.split('\n')
    const mid = Math.floor(lines.length / 2)
    lines.splice(mid, 0, '[Chorus]')
    finalLyrics = lines.join('\n')
  }

  // songStyle always prepends the genre
  const songStyle = `${resolvedGenre}, ${parsed.songStyle || 'upbeat, celebratory, energetic vocalist'}`

  return {
    title: title || 'Reward Song',
    lyrics: finalLyrics,
    imagePrompt,
    songStyle,
  }
}
