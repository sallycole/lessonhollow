import { beforeEach, describe, expect, it, vi } from 'vitest'

const nextCalls = {
  next: vi.fn(),
  redirect: vi.fn(),
  json: vi.fn(),
}

const getUser = vi.fn()
const createServerClient = vi.fn(() => ({
  auth: {
    getUser,
  },
}))

const db = {
  upsertUserApiKey: vi.fn(),
  getUserApiKey: vi.fn(),
  getPlayerById: vi.fn(),
  createSpeech: vi.fn(),
  updateSpeech: vi.fn(),
  getPlayerByAuthUserId: vi.fn(),
  updatePlayersByGuide: vi.fn(),
}

const createClient = vi.fn()
const encryptPassword = vi.fn()
const decryptPassword = vi.fn()
const getEffectiveUser = vi.fn()
const resolvePlayerContext = vi.fn()
const assertRewardAccess = vi.fn()
const generateLyricsFromLLM = vi.fn()
const getRecentCompletedTaskTitles = vi.fn()
const generateMedia = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@supabase/ssr', () => ({ createServerClient }))
vi.mock('next/server', () => ({
  NextResponse: {
    next: (...args: unknown[]) => nextCalls.next(...args),
    redirect: (...args: unknown[]) => nextCalls.redirect(...args),
    json: (...args: unknown[]) => nextCalls.json(...args),
  },
}))

vi.mock('@/lib/db', () => ({ db }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/crypto', () => ({ encryptPassword, decryptPassword }))
vi.mock('@/lib/masquerade', () => ({ getEffectiveUser, resolvePlayerContext }))
vi.mock('@/lib/credits', () => ({ assertRewardAccess }))
vi.mock('@/lib/generate-lyrics', () => ({
  generateLyrics: generateLyricsFromLLM,
  getRecentCompletedTaskTitles,
}))
vi.mock('@/lib/generate-media', () => ({ generateMedia }))
vi.mock('next/cache', () => ({ revalidatePath }))

describe('middleware regressions', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    nextCalls.next.mockImplementation(({ request }: { request: unknown }) => ({ type: 'next', request, cookies: { set: vi.fn() } }))
    nextCalls.redirect.mockImplementation((url: URL) => ({ type: 'redirect', url: url.toString() }))
    nextCalls.json.mockImplementation((body: unknown, init: unknown) => ({ type: 'json', body, init }))
  })

  it('redirects player users away from guide-only routes', async () => {
    getUser.mockResolvedValue({ data: { user: { user_metadata: { role: 'player' } } } })
    const { updateSession } = await import('../supabase/middleware')

    for (const path of ['/dashboard', '/players', '/account']) {
      const result = await updateSession(makeRequest(path))
      expect(result.type).toBe('redirect')
      expect(result.url).toBe(`https://example.com/today`)
    }
  })

  it('protects /progress and /enrollments routes for unauthenticated users', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { updateSession } = await import('../supabase/middleware')

    for (const path of ['/progress', '/progress/daily', '/enrollments', '/enrollments/123']) {
      const result = await updateSession(makeRequest(path))
      expect(result.type).toBe('redirect')
      const url = new URL(result.url)
      expect(url.pathname).toBe('/login')
      expect(url.searchParams.get('redirectTo')).toBe(path)
    }
  })
})

describe('fal.ai API key regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('encrypts the fal.ai key before storing it at rest', async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'guide-1', user_metadata: { role: 'guide' } } } }),
      },
    })
    encryptPassword.mockReturnValue('encrypted-at-rest')
    db.upsertUserApiKey.mockResolvedValue({ error: null })

    const { updateFalApiKey } = await import('@/app/(dashboard)/account/actions')
    await updateFalApiKey('  fal-key-123  ')

    expect(encryptPassword).toHaveBeenCalledWith('fal-key-123')
    expect(db.upsertUserApiKey).toHaveBeenCalledWith({
      user_id: 'guide-1',
      service: 'fal_ai',
      encrypted_key: 'encrypted-at-rest',
    })
  })

  it('decrypts the stored fal.ai key on retrieval before generation uses it', async () => {
    getEffectiveUser.mockResolvedValue({ userId: 'player-auth-1', isMasquerading: false })
    resolvePlayerContext.mockResolvedValue('player-1')
    assertRewardAccess.mockResolvedValue({ allowed: true })
    db.getUserApiKey.mockResolvedValue({ data: { encrypted_key: 'ciphertext' } })
    decryptPassword.mockReturnValue('fal-live-key')
    db.getPlayerById.mockResolvedValue({ data: { first_name: 'Ada', guide_id: 'guide-1', video_tasks_required: 20 } })
    db.createSpeech.mockResolvedValue({ data: { id: 'speech-1' } })
    getRecentCompletedTaskTitles.mockResolvedValue(['Fractions'])
    generateLyricsFromLLM.mockResolvedValue({ title: 'Song', lyrics: 'Lyrics', imagePrompt: 'Prompt' })
    generateMedia.mockResolvedValue({ audioUrl: 'audio.mp3', imageUrl: 'image.webp', durationSeconds: 42 })
    db.updateSpeech.mockResolvedValue({})

    const { generateSong } = await import('@/app/(player)/rewards/actions')
    const result = await generateSong('', '')

    expect(result).toEqual({})
    expect(decryptPassword).toHaveBeenCalledWith('ciphertext')
    expect(generateLyricsFromLLM).toHaveBeenCalledWith('Ada', ['Fractions'], 'fal-live-key', expect.any(String))
    expect(generateMedia).toHaveBeenCalledWith('player-1', expect.any(Object), 'fal-live-key', expect.any(String))
  })
})

function makeRequest(pathname: string) {
  return {
    url: `https://example.com${pathname}`,
    nextUrl: { pathname },
    headers: new Headers(),
    cookies: {
      getAll: () => [],
      get: () => undefined,
      set: vi.fn(),
    },
  } as unknown as import('next/server').NextRequest
}
