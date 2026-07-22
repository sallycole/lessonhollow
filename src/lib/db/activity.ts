import type { SupabaseClient } from '@supabase/supabase-js'
import { addDaysToDateKey, dateKeyInTimeZone } from '@/lib/date-tz'

export function createActivityDb(getClient: () => SupabaseClient) {
  return {
    // --- Spontaneous Entries ---

    async getSpontaneousEntriesByPlayer(playerId: string) {
      return getClient()
        .from('spontaneous_entries')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
    },

    async createSpontaneousEntry(data: {
      player_id: string
      title: string
      description?: string
      action_type: 'Read' | 'Watch' | 'Listen' | 'Do'
      resource_url?: string
      started_at?: string
      ended_at?: string
      time_spent_minutes?: number
      photo_url?: string
      notes?: string
    }) {
      return getClient()
        .from('spontaneous_entries')
        .insert(data)
        .select()
        .single()
    },

    async updateSpontaneousEntry(
      id: string,
      data: Partial<{
        notes: string | null
        photo_url: string | null
        time_spent_minutes: number
        started_at: string
      }>
    ) {
      return getClient()
        .from('spontaneous_entries')
        .update(data)
        .eq('id', id)
        .select()
        .single()
    },

    async deleteSpontaneousEntry(id: string) {
      return getClient()
        .from('spontaneous_entries')
        .delete()
        .eq('id', id)
    },

    async getSpontaneousEntryById(id: string) {
      return getClient()
        .from('spontaneous_entries')
        .select('*')
        .eq('id', id)
        .single()
    },

    // --- Feed ---

    // startDate/endDate are inclusive YYYY-MM-DD calendar days interpreted in
    // `timeZone` (defaults to UTC, which reproduces the original behavior). We
    // over-fetch a UTC window one day wider on each side, then keep only rows
    // whose timestamp lands within [startDate, endDate] in that zone.
    async getFeedItems(
      playerId: string,
      startDate: string,
      endDate: string,
      timeZone: string = 'UTC'
    ) {
      const client = getClient()

      // Get all enrollments for this player (any status — finished enrollments still show in feed)
      const { data: enrollments, error: enrollErr } = await client
        .from('enrollments')
        .select('id')
        .eq('player_id', playerId)

      const enrollmentIds = (enrollments ?? []).map((e: { id: string }) => e.id)

      const windowStart = `${addDaysToDateKey(startDate, -1)}T00:00:00.000Z`
      const windowEnd = `${addDaysToDateKey(endDate, 1)}T23:59:59.999Z`

      // Parallel fetch: completed/skipped player_tasks + spontaneous entries
      const [tasksResult, spontaneousResult] = await Promise.all([
        enrollmentIds.length > 0
          ? client
              .from('player_tasks')
              .select('*, tasks(*), enrollments(*, curricula(*))')
              .in('enrollment_id', enrollmentIds)
              .in('status', ['completed', 'skipped'])
              .gte('completed_at', windowStart)
              .lte('completed_at', windowEnd)
              .order('completed_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        client
          .from('spontaneous_entries')
          .select('*')
          .eq('player_id', playerId)
          .gte('created_at', windowStart)
          .lte('created_at', windowEnd)
          .order('created_at', { ascending: false }),
      ])

      const inRange = (ts: string | null): boolean => {
        if (!ts) return false
        const key = dateKeyInTimeZone(ts, timeZone)
        return key >= startDate && key <= endDate
      }

      return {
        data: {
          tasks: (tasksResult.data ?? []).filter((t: Record<string, unknown>) =>
            inRange(t.completed_at as string | null)
          ),
          spontaneous: (spontaneousResult.data ?? []).filter(
            (s: Record<string, unknown>) => inRange(s.created_at as string | null)
          ),
        },
        error: enrollErr || tasksResult.error || spontaneousResult.error || null,
      }
    },

    async getAllFeedItems(playerId: string) {
      const client = getClient()

      // Get all enrollments for this player (any status — finished enrollments still show in feed)
      const { data: enrollments, error: enrollErr } = await client
        .from('enrollments')
        .select('id')
        .eq('player_id', playerId)

      const enrollmentIds = (enrollments ?? []).map((e: { id: string }) => e.id)

      // Parallel fetch: all completed/skipped player_tasks + all spontaneous entries
      const [tasksResult, spontaneousResult] = await Promise.all([
        enrollmentIds.length > 0
          ? client
              .from('player_tasks')
              .select('*, tasks(*), enrollments(*, curricula(*))')
              .in('enrollment_id', enrollmentIds)
              .in('status', ['completed', 'skipped'])
              .order('completed_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        client
          .from('spontaneous_entries')
          .select('*')
          .eq('player_id', playerId)
          .order('created_at', { ascending: false }),
      ])

      return {
        data: {
          tasks: tasksResult.data ?? [],
          spontaneous: spontaneousResult.data ?? [],
        },
        error: enrollErr || tasksResult.error || spontaneousResult.error || null,
      }
    },

    async getActivitySummary(playerId: string, startDate: string, endDate: string) {
      const client = getClient()

      const { data: enrollments, error: enrollErr } = await client
        .from('enrollments')
        .select('id, curriculum_id, curricula(name)')
        .eq('player_id', playerId)

      if (enrollErr || !enrollments) {
        return { data: null, error: enrollErr }
      }

      const enrollmentIds = (enrollments ?? []).map((e: { id: string }) => e.id)

      const dayStart = `${startDate}T00:00:00.000Z`
      const dayEnd = `${endDate}T23:59:59.999Z`

      const [tasksResult, spontaneousResult] = await Promise.all([
        enrollmentIds.length > 0
          ? client
              .from('player_tasks')
              .select('enrollment_id, time_spent_minutes, status')
              .in('enrollment_id', enrollmentIds)
              .in('status', ['completed', 'skipped'])
              .gte('completed_at', dayStart)
              .lte('completed_at', dayEnd)
          : Promise.resolve({ data: [], error: null }),
        client
          .from('spontaneous_entries')
          .select('time_spent_minutes')
          .eq('player_id', playerId)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
      ])

      const enrollmentMap = new Map<string, {
        enrollmentId: string
        curriculumName: string
        completedCount: number
        skippedCount: number
        totalMinutes: number
      }>()
      for (const e of enrollments) {
        const curriculum = e.curricula as unknown as { name: string } | null
        enrollmentMap.set(e.id as string, {
          enrollmentId: e.id as string,
          curriculumName: curriculum?.name ?? 'Unknown',
          completedCount: 0,
          skippedCount: 0,
          totalMinutes: 0,
        })
      }

      for (const task of (tasksResult.data ?? []) as Array<{ enrollment_id: string; time_spent_minutes: number | null; status: string }>) {
        const entry = enrollmentMap.get(task.enrollment_id)
        if (entry) {
          if (task.status === 'completed') entry.completedCount++
          else if (task.status === 'skipped') entry.skippedCount++
          entry.totalMinutes += task.time_spent_minutes ?? 0
        }
      }

      const spontaneousData = (spontaneousResult.data ?? []) as Array<{ time_spent_minutes: number | null }>
      const spontaneousCount = spontaneousData.length
      const spontaneousMinutes = spontaneousData.reduce(
        (sum, s) => sum + (s.time_spent_minutes ?? 0), 0
      )

      return {
        data: {
          enrollments: Array.from(enrollmentMap.values()).filter(
            (e) => e.completedCount > 0 || e.skippedCount > 0
          ),
          spontaneousCount,
          spontaneousMinutes,
        },
        error: tasksResult.error || spontaneousResult.error || null,
      }
    },
  }
}
