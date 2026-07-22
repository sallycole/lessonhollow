import { redirect } from 'next/navigation'
import { getEffectiveUser } from '@/lib/masquerade'
import { db } from '@/lib/db'
import { resolveTimeZone, todayInTimeZone } from '@/lib/date-tz'
import { EnrollmentsClient, type PlayerProfile, type EnrollmentItem } from './enrollments-client'

export const dynamic = 'force-dynamic'

export default async function EnrollmentsPage() {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) redirect('/login')

  // Resolve the player record
  let player: PlayerProfile | null = null

  if (effectiveUser.isMasquerading && effectiveUser.playerId) {
    const { data } = await db.getPlayerById(effectiveUser.playerId)
    if (data) {
      player = {
        id: data.id,
        username: data.username,
        first_name: data.first_name,
        last_name: data.last_name,
        time_zone: data.time_zone,
      }
    }
  } else {
    const { data } = await db.getPlayerByAuthUserId(effectiveUser.userId)
    if (data) {
      player = {
        id: data.id,
        username: data.username,
        first_name: data.first_name,
        last_name: data.last_name,
        time_zone: data.time_zone,
      }
    }
  }

  if (!player) {
    redirect('/dashboard')
  }

  // Fetch enrollments with curriculum data
  const { data: enrollmentsData } = await db.getEnrollmentsByPlayer(player.id)
  const enrollments: EnrollmentItem[] = (enrollmentsData ?? []).map((e: Record<string, unknown>) => {
    const curricula = e.curricula as Record<string, unknown> | null
    return {
      id: e.id as string,
      curriculum_name: (curricula?.name as string) ?? 'Unknown Curriculum',
      enrollment_type: e.enrollment_type as 'core' | 'elective' | 'memorization',
      status: e.status as 'active' | 'paused' | 'finished',
      curriculum_id: e.curriculum_id as string,
      curriculum_available: curricula != null,
      target_completion_date: (e.target_completion_date as string) ?? null,
      start_date: (e.start_date as string) ?? null,
      study_days_per_week: (e.study_days_per_week as number) ?? null,
      target_loops: (e.target_loops as number) ?? null,
      grade_level: (curricula?.grade_level as string) ?? null,
      created_at: (e.created_at as string) ?? null,
      updated_at: (e.updated_at as string) ?? null,
    }
  })

  const todayKey = todayInTimeZone(resolveTimeZone(player.time_zone))

  return <EnrollmentsClient player={player} enrollments={enrollments} todayKey={todayKey} />
}
