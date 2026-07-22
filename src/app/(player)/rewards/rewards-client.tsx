'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RewardCard } from '@/components/reward-card'
import { ART_STYLES, MUSIC_GENRES } from '@/lib/styles'
import { REWARD_MESSAGES, LOADING_MESSAGES } from '@/lib/reward-messages'
import { generateSong } from './actions'
import { toast } from 'sonner'
import { Music, Lock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

type Speech = {
  id: string
  title: string
  speech_text: string | null
  audio_url: string | null
  video_url: string | null
  duration_seconds: number | null
  status: string
  created_at: string
}

export function RewardsClient({
  speeches,
  currentPage,
  totalPages,
  rewardUnlocked,
  tasksCompleted,
  tasksRequired,
  creditGateReason,
  isMasquerading = false,
}: {
  speeches: Speech[]
  currentPage: number
  totalPages: number
  rewardUnlocked: boolean
  tasksCompleted: number
  tasksRequired: number
  creditGateReason?: string | null
  isMasquerading?: boolean
}) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [artStyle, setArtStyle] = useState('')
  const [genre, setGenre] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const [congratsMessage] = useState(() =>
    REWARD_MESSAGES[Math.floor(Math.random() * REWARD_MESSAGES.length)]
  )

  useEffect(() => {
    if (!isGenerating) return
    const interval = setInterval(() => {
      setLoadingMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [isGenerating])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setLoadingMessageIndex(0)

    const result = await generateSong(artStyle, genre)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Reward generated!')
      router.refresh()
    }

    setIsGenerating(false)
  }, [artStyle, genre, router])

  const remaining = tasksRequired - tasksCompleted
  const isGated = !!creditGateReason
  const disabled = isGated || !rewardUnlocked || isGenerating

  return (
    <div className="rewards-shell">
      <hgroup className="rewards-header">
        <h1>Rewards</h1>
        <p>Complete tasks to unlock personalized, digital rewards.</p>
      </hgroup>

      <article className="rewards-generate">
        <div className="rewards-pickers">
          <select
            value={artStyle}
            onChange={(e) => setArtStyle(e.target.value)}
            aria-label="Art style"
            disabled={disabled}
          >
            <option value="">🎨 Surprise Me</option>
            {ART_STYLES.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            aria-label="Music genre"
            disabled={disabled}
          >
            <option value="">🎵 Surprise Me</option>
            {MUSIC_GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="rewards-generate-btn"
          onClick={handleGenerate}
          disabled={disabled}
        >
          {isGenerating ? (
            <><Loader2 size={18} className="spin" /> {LOADING_MESSAGES[loadingMessageIndex]}</>
          ) : !rewardUnlocked ? (
            <><Lock size={18} /> Generate Reward</>
          ) : (
            <><Music size={18} /> Generate Reward</>
          )}
        </button>

        <div aria-live="polite">
          {isGated ? null : isGenerating ? null : rewardUnlocked ? (
            <p className="rewards-status">
              {congratsMessage}
              <br />
              Use the button above to generate your reward.
            </p>
          ) : (
            <div className="rewards-locked">
              <p>Complete {remaining} more {remaining === 1 ? 'task' : 'tasks'} to unlock.</p>
              <div className="rewards-progress">
                <progress
                  value={Math.min(tasksCompleted, tasksRequired)}
                  max={tasksRequired}
                />
                <span>{tasksCompleted} / {tasksRequired}</span>
              </div>
            </div>
          )}
        </div>

        {creditGateReason === 'FAL_KEY_MISSING' && (
          <p className="rewards-status">
            {isMasquerading ? (
              <>
                No fal.ai API key configured. Please add one in your{' '}
                <Link href="/account">Account settings</Link>.
              </>
            ) : (
              "Your Guide needs to finish setting up rewards. Let them know you're interested!"
            )}
          </p>
        )}
      </article>

      {speeches.length > 0 || isGenerating ? (
        <div className="rewards-feed">
          {speeches.map((speech) => {
            if (speech.status === 'completed') {
              return <RewardCard key={speech.id} speech={speech} />
            }
            if (speech.status === 'generating') {
              return (
                <article key={speech.id} className="reward-generating">
                  <Loader2 size={32} className="spin" />
                  <p className="reward-generating-title">{speech.title}</p>
                  <p>This reward is still being generated…</p>
                </article>
              )
            }
            return null
          })}
        </div>
      ) : null}

      {totalPages > 1 && (
        <nav className="rewards-pagination" aria-label="Reward pagination">
          {currentPage > 1 ? (
            <Link href={`/rewards?page=${currentPage - 1}`} role="button" className="outline">
              <ChevronLeft size={16} /> Previous
            </Link>
          ) : (
            <button type="button" className="outline" disabled>
              <ChevronLeft size={16} /> Previous
            </button>
          )}

          <span className="rewards-page-label">Page {currentPage}</span>

          {currentPage < totalPages ? (
            <Link href={`/rewards?page=${currentPage + 1}`} role="button" className="outline">
              Next <ChevronRight size={16} />
            </Link>
          ) : (
            <button type="button" className="outline" disabled>
              Next <ChevronRight size={16} />
            </button>
          )}
        </nav>
      )}
    </div>
  )
}
