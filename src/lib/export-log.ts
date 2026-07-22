// Markdown exporters for the activity Log page clipboard buttons.
//
// The goal is a paste-into-a-chatbot artifact that carries the FULL context a
// parent sees in the UI: curriculum, action, status, time spent, when it
// happened, the description, and the notes line (where mastery / accuracy /
// SmartScore detail lives). Daily / weekly / monthly / yearly all share the
// same day-grouped shape so a bot can reason across any window.

export type LogActivity = {
  title: string
  description?: string | null
  actionType: string
  resourceUrl?: string | null
  curriculumName?: string | null
  status?: string | null
  timeSpentMinutes?: number | null
  timestamp?: string | null
  notes?: string | null
}

type Scope = 'daily' | 'weekly' | 'monthly' | 'yearly'

const SCOPE_TITLES: Record<Scope, string> = {
  daily: 'Daily Log',
  weekly: 'Weekly Log',
  monthly: 'Monthly Log',
  yearly: 'Yearly Log',
}

const FOOTER = '_Exported from Lesson Hollow_'

function formatMinutes(minutes: number | null | undefined): string {
  const m = minutes ?? 0
  if (m <= 0) return '0m'
  const hours = Math.floor(m / 60)
  const mins = Math.round(m % 60)
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function toDate(timestamp: string | null | undefined): Date | null {
  if (!timestamp) return null
  const d = new Date(timestamp)
  return isNaN(d.getTime()) ? null : d
}

function formatTime(timestamp: string | null | undefined): string {
  const d = toDate(timestamp)
  if (!d) return ''
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  const mm = String(minutes).padStart(2, '0')
  return `${h}:${mm} ${ampm}`
}

function formatFullDate(timestamp: string | null | undefined): string {
  const d = toDate(timestamp)
  if (!d) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Local YYYY-MM-DD, matching how the page groups items into days.
function dayKey(timestamp: string | null | undefined): string {
  const d = toDate(timestamp)
  if (!d) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatDayHeading(timestamp: string | null | undefined): string {
  const d = toDate(timestamp)
  if (!d) return 'Undated'
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function capitalize(str: string | null | undefined): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function countLabel(n: number): string {
  return `${n} ${n === 1 ? 'activity' : 'activities'}`
}

// Local YYYY-MM, matching how the page groups items into months.
function monthKey(timestamp: string | null | undefined): string {
  const d = toDate(timestamp)
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(key: string): string {
  const d = new Date(key + '-01T12:00:00')
  if (isNaN(d.getTime())) return key || 'Undated'
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Roll-up sections for the yearly copy: a per-curriculum ranking (most time
// first) and a per-month timeline (calendar order), so the aggregate a parent
// wants survives even if a chatbot truncates the full detail that follows.
function renderRollups(items: LogActivity[]): string[] {
  const byCurriculum = new Map<string, { count: number; minutes: number }>()
  const byMonth = new Map<string, { count: number; minutes: number }>()

  for (const item of items) {
    const minutes = item.timeSpentMinutes ?? 0

    const name = item.curriculumName || 'Spontaneous'
    const cur = byCurriculum.get(name) ?? { count: 0, minutes: 0 }
    cur.count += 1
    cur.minutes += minutes
    byCurriculum.set(name, cur)

    const mKey = monthKey(item.timestamp)
    const mon = byMonth.get(mKey) ?? { count: 0, minutes: 0 }
    mon.count += 1
    mon.minutes += minutes
    byMonth.set(mKey, mon)
  }

  const curriculumLines = Array.from(byCurriculum.entries())
    .sort(
      (a, b) =>
        b[1].minutes - a[1].minutes ||
        b[1].count - a[1].count ||
        a[0].localeCompare(b[0])
    )
    .map(
      ([name, s]) =>
        `- ${name} — ${countLabel(s.count)} · ${formatMinutes(s.minutes)}`
    )

  const monthLines = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, s]) =>
        `- ${formatMonthLabel(key)} — ${countLabel(s.count)} · ${formatMinutes(s.minutes)}`
    )

  return ['## By curriculum', ...curriculumLines, '', '## By month', ...monthLines]
}

// Renders one activity as an indented Markdown bullet block:
//   - **Title** — Curriculum
//     - Do · Completed · 5m · 9:00 AM
//     - Description
//     - Notes: ...
//     - Resource: https://...
function renderActivity(item: LogActivity): string {
  const source = item.curriculumName || 'Spontaneous'
  const meta = [
    item.actionType,
    capitalize(item.status ?? undefined) || null,
    formatMinutes(item.timeSpentMinutes),
    formatTime(item.timestamp) || null,
  ]
    .filter(Boolean)
    .join(' · ')

  const lines = [`- **${item.title}** — ${source}`, `  - ${meta}`]
  if (item.description) lines.push(`  - ${item.description}`)
  if (item.notes) lines.push(`  - Notes: ${item.notes}`)
  if (item.resourceUrl) lines.push(`  - Resource: ${item.resourceUrl}`)
  return lines.join('\n')
}

function summaryLine(
  playerName: string | undefined,
  count: number,
  totalMinutes: number
): string {
  const stats = `${countLabel(count)} · ${formatMinutes(totalMinutes)}`
  return playerName ? `Player: ${playerName} · ${stats}` : stats
}

// Single-activity copy (the clipboard button on one feed row).
export function generateActivityMarkdown(
  item: LogActivity,
  playerName?: string
): string {
  const dateLine = formatFullDate(item.timestamp)
  const parts: string[] = [dateLine ? `# Activity — ${dateLine}` : '# Activity']
  if (playerName) parts.push(`Player: ${playerName}`)
  parts.push('', renderActivity(item), '', FOOTER)
  return parts.join('\n')
}

// Period copy (day / week / month / year cards). Items are grouped by day,
// newest first, to match the on-screen feed ordering. When the period spans a
// single day (e.g. a daily card) the redundant day sub-headings are dropped.
export function generatePeriodMarkdown(opts: {
  scope: Scope
  periodLabel: string
  items: LogActivity[]
  playerName?: string
}): string {
  const { scope, periodLabel, items, playerName } = opts
  const totalMinutes = items.reduce((sum, i) => sum + (i.timeSpentMinutes ?? 0), 0)

  const header = `# ${SCOPE_TITLES[scope]} — ${periodLabel}`
  const parts: string[] = [header, summaryLine(playerName, items.length, totalMinutes)]

  if (items.length === 0) {
    parts.push('', 'No activities in this period.', '', FOOTER)
    return parts.join('\n')
  }

  // Group into days, newest first (both across days and within a day) to match
  // the on-screen feed.
  const dayMap = new Map<string, LogActivity[]>()
  for (const item of items) {
    const key = dayKey(item.timestamp)
    if (!dayMap.has(key)) dayMap.set(key, [])
    dayMap.get(key)!.push(item)
  }
  const orderedDays = Array.from(dayMap.entries()).sort(([a], [b]) =>
    b.localeCompare(a)
  )
  for (const [, dayItems] of orderedDays) {
    dayItems.sort(
      (a, b) =>
        (toDate(b.timestamp)?.getTime() ?? 0) -
        (toDate(a.timestamp)?.getTime() ?? 0)
    )
  }

  // Yearly copies can run to thousands of activities, past what many chatbots
  // accept in one paste. Lead with roll-ups so the aggregate survives even if
  // the detail below gets truncated at the destination.
  if (scope === 'yearly') {
    parts.push('', ...renderRollups(items), '', '## Activity detail')
  }

  const multiDay = orderedDays.length > 1

  for (const [, dayItems] of orderedDays) {
    parts.push('')
    if (multiDay) {
      const dayMinutes = dayItems.reduce(
        (sum, i) => sum + (i.timeSpentMinutes ?? 0),
        0
      )
      const heading = formatDayHeading(dayItems[0].timestamp)
      parts.push(
        `### ${heading} (${countLabel(dayItems.length)} · ${formatMinutes(dayMinutes)})`
      )
    }
    parts.push(dayItems.map(renderActivity).join('\n'))
  }

  parts.push('', FOOTER)
  return parts.join('\n')
}
