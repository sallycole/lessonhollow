import { redirect } from 'next/navigation'
import { getEffectiveUser } from '@/lib/masquerade'
import { db } from '@/lib/db'
import { dateKeyInTimeZone, resolveTimeZone } from '@/lib/date-tz'
import { FeedTabs, type FeedItem } from './feed-tabs'

export const dynamic = 'force-dynamic'

export type DayData = {
  dateKey: string // YYYY-MM-DD
  dateFormatted: string // "March 22, 2026"
  dayName: string // "Saturday"
  items: FeedItem[]
  totalMinutes: number
  activityCount: number
}

export type WeekData = {
  weekKey: string // YYYY-MM-DD (Monday start)
  weekLabel: string // "Mar 17 – Mar 23, 2026"
  totalMinutes: number
  activityCount: number
}

export type MonthData = {
  monthKey: string // YYYY-MM
  monthLabel: string // "March 2026"
  totalMinutes: number
  activityCount: number
}

export type YearData = {
  yearKey: string // YYYY
  yearLabel: string // "2026"
  totalMinutes: number
  activityCount: number
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)
  const yyyy = monday.getFullYear()
  const mm = String(monday.getMonth() + 1).padStart(2, '0')
  const dd = String(monday.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function getSundayOfWeek(mondayStr: string): string {
  const d = new Date(mondayStr + 'T12:00:00')
  d.setDate(d.getDate() + 6)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

function formatWeekLabel(mondayStr: string, sundayStr: string): string {
  const monday = new Date(mondayStr + 'T12:00:00')
  const sunday = new Date(sundayStr + 'T12:00:00')
  const startStr = monday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const endStr = sunday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startStr} – ${endStr}`
}

function formatMonthLabel(monthKey: string): string {
  const d = new Date(monthKey + '-01T12:00:00')
  return d.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export default async function FeedPage() {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) redirect('/login')

  let playerId: string | null = null
  let playerFirstName = ''
  let playerTimeZone: string | null = null

  if (effectiveUser.isMasquerading && effectiveUser.playerId) {
    playerId = effectiveUser.playerId
    const { data: player } = await db.getPlayerById(playerId)
    playerFirstName = player?.first_name ?? ''
    playerTimeZone = player?.time_zone ?? null
  } else {
    const { data: player } = await db.getPlayerByAuthUserId(effectiveUser.userId)
    if (player) {
      playerId = player.id
      playerFirstName = player.first_name ?? ''
      playerTimeZone = player.time_zone ?? null
    }
  }

  if (!playerId) {
    redirect('/dashboard')
  }

  const { data } = await db.getAllFeedItems(playerId)

  // Map completed player_tasks to FeedItem (skip skipped tasks)
  const taskItems: FeedItem[] = (
    (data?.tasks ?? []) as Record<string, unknown>[]
  )
    .filter((pt) => pt.status !== 'skipped')
    .map((pt: Record<string, unknown>) => {
      const task = pt.tasks as Record<string, unknown> | null
      const enrollment = pt.enrollments as Record<string, unknown> | null
      const curriculum = enrollment?.curricula as Record<string, unknown> | null
      return {
        id: pt.id as string,
        type: 'task' as const,
        title: (task?.title as string) ?? '',
        description: (task?.description as string) ?? null,
        actionType: (task?.action_type as string) ?? 'Do',
        resourceUrl: (task?.resource_url as string) ?? null,
        curriculumName: (curriculum?.name as string) ?? 'Unknown',
        status: pt.status as 'completed' | 'skipped',
        timeSpentMinutes: (pt.time_spent_minutes as number) ?? 0,
        timestamp: (pt.started_at as string) ?? (pt.completed_at as string) ?? '',
        notes: (pt.notes as string) ?? null,
      }
    })

  // Map spontaneous entries to FeedItem
  const spontaneousItems: FeedItem[] = (data?.spontaneous ?? []).map(
    (se: Record<string, unknown>) => ({
      id: se.id as string,
      type: 'spontaneous' as const,
      title: (se.title as string) ?? '',
      description: (se.description as string) ?? null,
      actionType: (se.action_type as string) ?? 'Do',
      resourceUrl: (se.resource_url as string) ?? null,
      curriculumName: null,
      status: 'completed' as const,
      timeSpentMinutes: (se.time_spent_minutes as number) ?? 0,
      timestamp: (se.started_at as string) ?? (se.created_at as string) ?? '',
      notes: (se.notes as string) ?? null,
    })
  )

  // Merge and sort by timestamp, newest first
  const allItems = [...taskItems, ...spontaneousItems].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  // Group into days using the player's time zone so evening activities don't
  // roll into the next UTC day on the (UTC) server.
  const timeZone = resolveTimeZone(playerTimeZone)
  const dayMap = new Map<string, FeedItem[]>()
  for (const item of allItems) {
    const key = dateKeyInTimeZone(item.timestamp, timeZone)
    if (!dayMap.has(key)) dayMap.set(key, [])
    dayMap.get(key)!.push(item)
  }

  const days: DayData[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, items]) => ({
      dateKey,
      dateFormatted: formatDateFull(dateKey),
      dayName: formatDayName(dateKey),
      items,
      totalMinutes: items.reduce((sum, i) => sum + i.timeSpentMinutes, 0),
      activityCount: items.length,
    }))

  // Group into weeks (Monday-Sunday)
  const weekMap = new Map<string, { totalMinutes: number; activityCount: number }>()
  for (const day of days) {
    const mondayKey = getMondayOfWeek(day.dateKey)
    const existing = weekMap.get(mondayKey) ?? { totalMinutes: 0, activityCount: 0 }
    existing.totalMinutes += day.totalMinutes
    existing.activityCount += day.activityCount
    weekMap.set(mondayKey, existing)
  }

  const weeks: WeekData[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([mondayKey, stats]) => {
      const sundayKey = getSundayOfWeek(mondayKey)
      return {
        weekKey: mondayKey,
        weekLabel: formatWeekLabel(mondayKey, sundayKey),
        totalMinutes: stats.totalMinutes,
        activityCount: stats.activityCount,
      }
    })

  // Group into months
  const monthMap = new Map<string, { totalMinutes: number; activityCount: number }>()
  for (const day of days) {
    const monthKey = day.dateKey.slice(0, 7) // YYYY-MM
    const existing = monthMap.get(monthKey) ?? { totalMinutes: 0, activityCount: 0 }
    existing.totalMinutes += day.totalMinutes
    existing.activityCount += day.activityCount
    monthMap.set(monthKey, existing)
  }

  const months: MonthData[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, stats]) => ({
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      totalMinutes: stats.totalMinutes,
      activityCount: stats.activityCount,
    }))

  // Group into years
  const yearMap = new Map<string, { totalMinutes: number; activityCount: number }>()
  for (const day of days) {
    const yearKey = day.dateKey.slice(0, 4) // YYYY
    const existing = yearMap.get(yearKey) ?? { totalMinutes: 0, activityCount: 0 }
    existing.totalMinutes += day.totalMinutes
    existing.activityCount += day.activityCount
    yearMap.set(yearKey, existing)
  }

  const years: YearData[] = Array.from(yearMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([yearKey, stats]) => ({
      yearKey,
      yearLabel: yearKey,
      totalMinutes: stats.totalMinutes,
      activityCount: stats.activityCount,
    }))

  return (
    <FeedTabs
      days={days}
      weeks={weeks}
      months={months}
      years={years}
      playerFirstName={playerFirstName}
    />
  )
}
