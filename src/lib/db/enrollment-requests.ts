import type { SupabaseClient } from '@supabase/supabase-js'

export function createEnrollmentRequestsDb(getClient: () => SupabaseClient) {
  return {
    async createEnrollmentRequest(data: {
      player_id: string
      curriculum_id: string
      guide_id: string
      enrollment_type: string
      study_days_per_week: number
      tasks_per_study_day: number
      target_completion_date?: string
      target_loops?: number
      start_date?: string
    }) {
      return getClient()
        .from('enrollment_requests')
        .insert(data)
        .select()
        .single()
    },

    async getPendingEnrollmentRequests(guideId: string) {
      return getClient()
        .from('enrollment_requests')
        .select('*, players(id, first_name, last_name, free_enrollment_used), curricula(name)')
        .eq('guide_id', guideId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
    },

    async getPendingEnrollmentRequestCount(guideId: string) {
      return getClient()
        .from('enrollment_requests')
        .select('id', { count: 'exact', head: true })
        .eq('guide_id', guideId)
        .eq('status', 'pending')
    },

    async getEnrollmentRequestById(id: string) {
      return getClient()
        .from('enrollment_requests')
        .select('*, players(id, first_name, last_name, free_enrollment_used, guide_id), curricula(name)')
        .eq('id', id)
        .single()
    },

    async updateEnrollmentRequestStatus(
      id: string,
      status: 'approved' | 'denied',
      guideResponse?: string
    ) {
      return getClient()
        .from('enrollment_requests')
        .update({
          status,
          ...(guideResponse !== undefined ? { guide_response: guideResponse } : {}),
        })
        .eq('id', id)
        .select()
        .single()
    },

    async getPendingRequestByPlayerAndCurriculum(
      playerId: string,
      curriculumId: string
    ) {
      return getClient()
        .from('enrollment_requests')
        .select('*')
        .eq('player_id', playerId)
        .eq('curriculum_id', curriculumId)
        .eq('status', 'pending')
        .maybeSingle()
    },

    async getLatestRequestByPlayerAndCurriculum(
      playerId: string,
      curriculumId: string
    ) {
      return getClient()
        .from('enrollment_requests')
        .select('*')
        .eq('player_id', playerId)
        .eq('curriculum_id', curriculumId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    },
  }
}
