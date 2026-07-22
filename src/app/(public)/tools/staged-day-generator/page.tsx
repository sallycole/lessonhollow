import type { Metadata } from 'next'
// Internal marketing-mockup renderer. Styled with Pico tokens like the
// rest of the app; the phone-frame and 9:16 proportions in
// staged-day-generator.css are structural (Pico has no device-mockup
// component). Renders inside root's <main class="container">, so the
// outer wrapper is a plain <div> (no nested <main>).

import fs from 'node:fs/promises'
import path from 'node:path'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowDown,
  BookOpen,
  CheckCircle2,
  Clock3,
  Layers3,
  MapPinned,
  NotebookPen,
  PlayCircle,
  Sparkles,
  Smartphone,
  Video,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Mock Today Page Tool — Lesson Hollow',
  description:
    'Turn a curriculum stack into a screenshot-ready Lesson Hollow day and a TikTok-ready before-and-after template.',
  openGraph: {
    title: 'Mock Today Page Tool — Lesson Hollow',
    description:
      'Turn a curriculum stack into a screenshot-ready Lesson Hollow day and a TikTok-ready before-and-after template.',
    images: [
      {
        url: '/og/lesson-hollow-collage-og.png',
        width: 1200,
        height: 630,
        alt: 'Lesson Hollow Tools',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mock Today Page Tool — Lesson Hollow',
    description:
      'Turn a curriculum stack into a screenshot-ready Lesson Hollow day and a TikTok-ready before-and-after template.',
    images: ['/og/lesson-hollow-collage-og.png'],
  },
}

type MockTask = {
  title: string
  note: string
  duration: string
  kind: 'read' | 'watch' | 'make' | 'map' | 'narrate' | 'reflect'
  done?: boolean
}

type SourceItem = {
  label: string
  detail: string
  type: 'book' | 'video' | 'project' | 'map' | 'prompt' | 'note'
}

type TiktokTemplate = {
  hook: string
  beforeLabel: string
  afterLabel: string
  caption: string
  beats: string[]
  cta: string
}

type MockDay = {
  slug: string
  learner: string
  title: string
  strapline: string
  signal: string
  sourceTitle?: string
  sourceSubtitle?: string
  sourceItems?: SourceItem[]
  tiktok?: TiktokTemplate
  tasks: MockTask[]
}

async function getDayFromFile(slug: string): Promise<MockDay | null> {
  const filePath = path.join(process.cwd(), 'content/staged-days', `${slug}.json`)
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as MockDay
  } catch {
    return null
  }
}

async function getAvailableDays(): Promise<Array<{ slug: string; title: string }>> {
  const dir = path.join(process.cwd(), 'content/staged-days')
  const files = await fs.readdir(dir)
  const items = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        const raw = await fs.readFile(path.join(dir, file), 'utf8')
        const data = JSON.parse(raw) as MockDay
        return { slug: data.slug, title: data.title }
      })
  )
  return items.sort((a, b) => a.title.localeCompare(b.title))
}

function kindMeta(kind: MockTask['kind']) {
  switch (kind) {
    case 'read':
      return { label: 'Read', icon: <BookOpen size={16} /> }
    case 'watch':
      return { label: 'Watch', icon: <PlayCircle size={16} /> }
    case 'make':
      return { label: 'Make', icon: <Sparkles size={16} /> }
    case 'map':
      return { label: 'Map', icon: <MapPinned size={16} /> }
    case 'narrate':
      return { label: 'Narrate', icon: <NotebookPen size={16} /> }
    case 'reflect':
      return { label: 'Reflect', icon: <Clock3 size={16} /> }
  }
}

function sourceMeta(type: SourceItem['type']) {
  switch (type) {
    case 'book':
      return { label: 'Book', icon: <BookOpen size={16} /> }
    case 'video':
      return { label: 'Video', icon: <Video size={16} /> }
    case 'project':
      return { label: 'Project', icon: <Sparkles size={16} /> }
    case 'map':
      return { label: 'Map', icon: <MapPinned size={16} /> }
    case 'prompt':
      return { label: 'Prompt', icon: <NotebookPen size={16} /> }
    case 'note':
      return { label: 'Note', icon: <Layers3 size={16} /> }
  }
}

function defaultTiktok(sampleDay: MockDay): TiktokTemplate {
  return {
    hook: 'Take this curriculum stack and turn it into a startable day.',
    beforeLabel: 'Take this',
    afterLabel: 'Turn it into this',
    caption: 'A pile of good resources is not the same thing as a day a kid can actually start.',
    beats: [
      'Show the source stack first.',
      'Cut to the cleaned-up Today page.',
      'Slow scroll the task list from top to bottom.',
    ],
    cta: `Lesson Hollow turns ${sampleDay.title.toLowerCase()} into a clear next step.`,
  }
}

function parseMinutes(duration: string) {
  const match = duration.match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : 0
}

function TodayPhone({ sampleDay, compact = false }: { sampleDay: MockDay; compact?: boolean }) {
  const completedCount = sampleDay.tasks.filter((task) => task.done).length
  const totalMinutes = sampleDay.tasks.reduce((sum, task) => sum + parseMinutes(task.duration), 0)

  return (
    <div className="sdg-phone" data-compact={compact || undefined}>
      <div className="sdg-phone-screen">
        <div className="sdg-phone-header">
          <div className="sdg-phone-header-row">
            <span>Today</span>
            <span>Mock Player Day</span>
          </div>
          <h1 className="sdg-phone-title">{sampleDay.learner}&rsquo;s Day</h1>
          <p className="sdg-phone-strapline">{sampleDay.strapline}</p>
          <div className="sdg-chip-row">
            <span className="sdg-chip-dark">{sampleDay.title}</span>
            <span className="sdg-chip-emerald">{sampleDay.signal}</span>
          </div>
        </div>

        <div className="sdg-phone-body">
          <div className="sdg-stat-grid">
            <div className="sdg-stat">
              <p className="sdg-stat-label">Progress</p>
              <p className="sdg-stat-value">
                {completedCount}/{sampleDay.tasks.length}
              </p>
            </div>
            <div className="sdg-stat">
              <p className="sdg-stat-label">Time</p>
              <p className="sdg-stat-value">{totalMinutes}m</p>
            </div>
          </div>

          {sampleDay.tasks.map((task, index) => {
            const meta = kindMeta(task.kind)
            return (
              <article
                key={`${task.title}-${index}`}
                className="sdg-task"
                data-done={task.done || undefined}
              >
                <div className="sdg-task-row">
                  <div className="sdg-task-main">
                    <div className="sdg-task-icon">
                      {task.done ? <CheckCircle2 size={16} /> : meta.icon}
                    </div>
                    <div className="sdg-task-text">
                      <div className="sdg-task-titlerow">
                        <p className="sdg-task-title">{task.title}</p>
                        <span className="sdg-chip-outline">{meta.label}</span>
                      </div>
                      <p className="sdg-task-note">{task.note}</p>
                    </div>
                  </div>
                  <p className="sdg-task-duration">{task.duration}</p>
                </div>
                <div className="sdg-task-footer">
                  <span>Step {index + 1}</span>
                  <span>{task.done ? 'Completed' : 'Ready to start'}</span>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SourceStack({ sampleDay }: { sampleDay: MockDay }) {
  const items = sampleDay.sourceItems ?? []

  return (
    <div className="sdg-source">
      <div>
        <p className="sdg-eyebrow">Source stack</p>
        <h2 className="sdg-source-title">
          {sampleDay.sourceTitle ?? 'Public curriculum stack'}
        </h2>
        <p className="sdg-source-subtitle">
          {sampleDay.sourceSubtitle ?? 'The raw stack before Lesson Hollow turns it into a clean day.'}
        </p>
      </div>

      <div className="sdg-source-list">
        {items.map((item, index) => {
          const meta = sourceMeta(item.type)
          return (
            <div key={`${item.label}-${index}`} className="sdg-source-item">
              <div className="sdg-source-item-row">
                <div className="sdg-source-icon">{meta.icon}</div>
                <div>
                  <div className="sdg-task-titlerow">
                    <p className="sdg-source-label">{item.label}</p>
                    <span className="sdg-chip-outline">{meta.label}</span>
                  </div>
                  <p className="sdg-source-detail">{item.detail}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TiktokTemplateCard({ sampleDay }: { sampleDay: MockDay }) {
  const tiktok = sampleDay.tiktok ?? defaultTiktok(sampleDay)

  return (
    <div className="sdg-tiktok">
      <div className="sdg-tiktok-inner">
        <div className="sdg-tiktok-topbar">
          <span>TikTok template</span>
          <span>9:16 mock</span>
        </div>

        <div className="sdg-tiktok-hook">
          <p className="sdg-eyebrow sdg-eyebrow-light">Hook</p>
          <p className="sdg-tiktok-hook-text">{tiktok.hook}</p>
          <p className="sdg-tiktok-caption">{tiktok.caption}</p>
        </div>

        <div className="sdg-tiktok-stack">
          <section className="sdg-tiktok-before">
            <div className="sdg-eyebrow sdg-eyebrow-row">
              <Layers3 size={16} />
              <span>{tiktok.beforeLabel}</span>
            </div>
            <div className="sdg-tiktok-before-body">
              <SourceStack sampleDay={sampleDay} />
            </div>
          </section>

          <div className="sdg-tiktok-arrow">
            <ArrowDown size={16} />
            <span>{tiktok.afterLabel}</span>
          </div>

          <section className="sdg-tiktok-after">
            <div className="sdg-eyebrow sdg-eyebrow-row">
              <Smartphone size={16} />
              <span>Lesson Hollow mock Today page</span>
            </div>
            <TodayPhone sampleDay={sampleDay} compact />
          </section>
        </div>

        <div className="sdg-tiktok-shotlist">
          <p className="sdg-eyebrow sdg-eyebrow-light">Shot list</p>
          <ol className="sdg-tiktok-beats">
            {tiktok.beats.map((beat, index) => (
              <li key={`${beat}-${index}`}>
                <span className="sdg-tiktok-beat-num">{index + 1}.</span>
                <span>{beat}</span>
              </li>
            ))}
          </ol>
          <p className="sdg-tiktok-cta">{tiktok.cta}</p>
        </div>
      </div>
    </div>
  )
}

function ScrollCapture({ sampleDay }: { sampleDay: MockDay }) {
  const tiktok = sampleDay.tiktok ?? defaultTiktok(sampleDay)

  return (
    <div className="sdg-scroll">
      <section className="sdg-scroll-section">
        <p className="sdg-eyebrow">Open</p>
        <h2 className="sdg-scroll-hook">{tiktok.hook}</h2>
        <p className="sdg-scroll-caption">{tiktok.caption}</p>
      </section>

      <section className="sdg-scroll-section">
        <div className="sdg-eyebrow sdg-eyebrow-row">
          <Layers3 size={16} />
          <span>{tiktok.beforeLabel}</span>
        </div>
        <div className="sdg-scroll-body">
          <SourceStack sampleDay={sampleDay} />
        </div>
      </section>

      <section className="sdg-scroll-section">
        <div className="sdg-eyebrow sdg-eyebrow-row">
          <Smartphone size={16} />
          <span>{tiktok.afterLabel}</span>
        </div>
        <div className="sdg-scroll-body sdg-scroll-body-center">
          <TodayPhone sampleDay={sampleDay} compact />
        </div>
      </section>

      <section className="sdg-scroll-section">
        <p className="sdg-eyebrow">Voiceover beats</p>
        <div className="sdg-scroll-beats">
          {tiktok.beats.map((beat, index) => (
            <div key={`${beat}-${index}`} className="sdg-scroll-beat">
              <span className="sdg-scroll-beat-num">{index + 1}.</span>
              {beat}
            </div>
          ))}
        </div>
        <p className="sdg-scroll-cta">{tiktok.cta}</p>
      </section>
    </div>
  )
}

export default async function StagedDayGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; view?: string }>
}) {
  const params = await searchParams
  const availableDays = await getAvailableDays()
  const activeSlug = params.slug ?? availableDays[0]?.slug
  const view = params.view ?? 'tiktok'
  const sampleDay = activeSlug ? await getDayFromFile(activeSlug) : null

  if (!sampleDay) {
    notFound()
  }

  const views = [
    { key: 'tiktok', label: 'TikTok template' },
    { key: 'today', label: 'Today page' },
    { key: 'scroll', label: 'Scroll capture' },
  ]

  return (
    <div className="sdg-page">
      <div className="sdg-shell">
        <header className="sdg-header">
          <h1 className="sdg-header-title">Mock Today Page Tool</h1>
          <p className="sdg-header-desc">
            Turn a curriculum stack into a screenshot-ready Lesson Hollow day and a TikTok-ready before-and-after template.
          </p>
        </header>

        <section className="sdg-layout">
          <div className="sdg-controls">
            <h2 className="sdg-controls-title">Content file to mock screen to video template</h2>
            <div className="sdg-controls-body">
              <p>
                One JSON file now drives three outputs from the same content: a clean mock Today page,
                a TikTok-ready before-and-after template, and a tall slow-scroll capture layout.
              </p>

              <div className="sdg-info-box">
                <p className="sdg-eyebrow">Active content file</p>
                <p className="sdg-mono">content/staged-days/{sampleDay.slug}.json</p>
              </div>

              <div className="sdg-control-group">
                <p className="sdg-eyebrow">Choose a scenario</p>
                <div className="sdg-chip-list">
                  {availableDays.map((day) => (
                    <Link
                      key={day.slug}
                      href={`/tools/staged-day-generator?slug=${day.slug}&view=${view}`}
                      className="sdg-pill"
                      data-active={day.slug === sampleDay.slug || undefined}
                    >
                      {day.title}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="sdg-control-group">
                <p className="sdg-eyebrow">Choose an output</p>
                <div className="sdg-chip-list">
                  {views.map((option) => (
                    <Link
                      key={option.key}
                      href={`/tools/staged-day-generator?slug=${sampleDay.slug}&view=${option.key}`}
                      className="sdg-pill"
                      data-active={option.key === view || undefined}
                    >
                      {option.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="sdg-info-grid">
                <div className="sdg-info-box">
                  <p className="sdg-eyebrow">Best for</p>
                  <p className="sdg-info-text">
                    local screenshots, screen recordings, founder posts, TikTok mock videos, and before-and-after demos.
                  </p>
                </div>
                <div className="sdg-info-box">
                  <p className="sdg-eyebrow">What changed</p>
                  <p className="sdg-info-text">
                    the page now includes the raw source stack, the cleaned-up day, and the TikTok framing in one place.
                  </p>
                </div>
              </div>

              <div className="sdg-next-step">
                Next useful step: add an export path for fixed-size PNG frames and simple caption overlays so this can feed a fully headless video render.
              </div>
            </div>
          </div>

          <div className="sdg-preview">
            {view === 'today' ? (
              <TodayPhone sampleDay={sampleDay} />
            ) : view === 'scroll' ? (
              <ScrollCapture sampleDay={sampleDay} />
            ) : (
              <TiktokTemplateCard sampleDay={sampleDay} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
