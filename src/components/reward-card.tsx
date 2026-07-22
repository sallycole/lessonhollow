'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Maximize2,
  Minimize2,
  ChevronsUpDown,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

type Speech = {
  id: string
  title: string
  speech_text: string | null
  audio_url: string | null
  video_url: string | null
  duration_seconds: number | null
  created_at: string
}

// --- AudioControls ---

function AudioControls({ audioUrl }: { audioUrl: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)

  function togglePlay() {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(() => {})
    }
  }

  function toggleMute() {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !isMuted
    setIsMuted(!isMuted)
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audioRef.current) {
      audioRef.current.volume = v
    }
    if (v > 0 && isMuted) {
      setIsMuted(false)
      if (audioRef.current) audioRef.current.muted = false
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={togglePlay}
        className="reward-overlay-btn"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </button>
      <div className="reward-volume">
        <button
          type="button"
          onClick={toggleMute}
          className="reward-volume-btn"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="reward-volume-slider"
          aria-label="Volume"
        />
      </div>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      )}
    </>
  )
}

// --- DraggableLyrics ---

function DraggableLyrics({
  title,
  speechText,
  createdAt,
  containerHeight,
}: {
  title: string
  speechText: string
  createdAt: string
  containerHeight: number
}) {
  const DEFAULT_HEIGHT = 125
  const maxHeight = containerHeight - 60
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  const onDragStart = useCallback(
    (clientY: number) => {
      isDragging.current = true
      startY.current = clientY
      startHeight.current = height
    },
    [height]
  )

  useEffect(() => {
    function onMove(clientY: number) {
      if (!isDragging.current) return
      const delta = startY.current - clientY
      const newH = Math.max(DEFAULT_HEIGHT, Math.min(maxHeight, startHeight.current + delta))
      setHeight(newH)
    }

    function onMouseMove(e: MouseEvent) {
      onMove(e.clientY)
    }
    function onTouchMove(e: TouchEvent) {
      onMove(e.touches[0].clientY)
    }
    function onEnd() {
      isDragging.current = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchend', onEnd)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchend', onEnd)
    }
  }, [maxHeight])

  const dateStr = new Date(createdAt).toLocaleDateString()

  return (
    <div className="reward-lyrics" style={{ height }}>
      <div
        className="reward-lyrics-handle"
        onMouseDown={(e) => onDragStart(e.clientY)}
        onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
        role="separator"
        aria-label="Drag to resize lyrics"
      >
        <ChevronsUpDown size={20} />
      </div>

      <div className="reward-lyrics-head">
        <span className="reward-lyrics-title">{title}</span>
        <span className="reward-lyrics-date">{dateStr}</span>
      </div>

      <div className="reward-lyrics-body" style={{ height: height - 60 }}>
        <p>{speechText}</p>
      </div>
    </div>
  )
}

// --- RewardCard ---

export function RewardCard({ speech }: { speech: Speech }) {
  const cardRef = useRef<HTMLElement>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [containerHeight, setContainerHeight] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window)
  }, [])

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    const el = imageContainerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function toggleFullscreen() {
    if (!cardRef.current) return
    if (isFullscreen) {
      document.exitFullscreen().catch(() => {})
    } else {
      cardRef.current.requestFullscreen().catch(() => {})
    }
  }

  async function handleDownload() {
    setIsDownloading(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const title = speech.title || 'Reward Song'

      const fetches: Promise<void>[] = []

      if (speech.audio_url) {
        fetches.push(
          fetch(speech.audio_url)
            .then((r) => r.blob())
            .then((blob) => {
              zip.file(`${title} - Audio.mp3`, blob)
            })
        )
      }

      if (speech.video_url) {
        const ext = speech.video_url.includes('.png') ? 'png' : 'webp'
        fetches.push(
          fetch(speech.video_url)
            .then((r) => r.blob())
            .then((blob) => {
              zip.file(`${title} - Image.${ext}`, blob)
            })
        )
      }

      if (speech.speech_text) {
        zip.file(`${title} - Lyrics.txt`, speech.speech_text)
      }

      await Promise.all(fetches)
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <article ref={cardRef} className="reward-card" data-fullscreen={isFullscreen || undefined}>
      <div className="reward-card-frame">
        <div
          ref={imageContainerRef}
          className="reward-image"
          onMouseEnter={() => !isTouchDevice && setIsHovering(true)}
          onMouseLeave={() => !isTouchDevice && setIsHovering(false)}
          onClick={() => isTouchDevice && setIsHovering((h) => !h)}
        >
          {speech.video_url ? (
            <Image
              src={speech.video_url}
              alt={speech.title}
              fill
              unoptimized
              className={isFullscreen ? 'reward-img-contain' : 'reward-img-cover'}
            />
          ) : (
            <div className="reward-image-placeholder">
              <span>🎵</span>
            </div>
          )}

          <div className="reward-topbar" data-visible={isHovering || undefined}>
            <div className="reward-topbar-group">
              <AudioControls audioUrl={speech.audio_url} />
            </div>
            <div className="reward-topbar-group">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="reward-overlay-btn"
                aria-label="Download"
              >
                {isDownloading ? <Loader2 size={20} className="spin" /> : <Download size={20} />}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="reward-overlay-btn"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          </div>

          {speech.speech_text && containerHeight > 0 && (
            <DraggableLyrics
              title={speech.title}
              speechText={speech.speech_text}
              createdAt={speech.created_at}
              containerHeight={containerHeight}
            />
          )}
        </div>
      </div>
    </article>
  )
}
