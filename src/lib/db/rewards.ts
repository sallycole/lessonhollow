import type { SupabaseClient } from '@supabase/supabase-js'

export function createRewardsDb(getClient: () => SupabaseClient) {
  return {
    // --- Feedback ---

    async createFeedback(data: {
      user_id: string
      feedback_type: 'Bug' | 'Feature' | 'Use Case' | 'General'
      title: string
      details?: string
    }) {
      return getClient()
        .from('feedback')
        .insert(data)
        .select()
        .single()
    },

    async getFeedbackByUser(userId: string) {
      return getClient()
        .from('feedback')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    },

    // --- Speeches (Rewards) ---

    async getSpeechesByPlayer(playerId: string) {
      return getClient()
        .from('speeches')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
    },

    async getSpeechesByPlayerPaginated(playerId: string, page: number, pageSize: number) {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      return getClient()
        .from('speeches')
        .select('*', { count: 'exact' })
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .range(from, to)
    },

    async getSpeechCount(playerId: string) {
      return getClient()
        .from('speeches')
        .select('id', { count: 'exact', head: true })
        .eq('player_id', playerId)
    },

    async getLastCompletedSpeech(playerId: string) {
      return getClient()
        .from('speeches')
        .select('id, created_at')
        .eq('player_id', playerId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    },

    async getTasksCompletedSince(playerId: string, since: string | null) {
      const client = getClient()

      // Get enrollment IDs for this player
      const { data: enrollments } = await client
        .from('enrollments')
        .select('id')
        .eq('player_id', playerId)

      const enrollmentIds = enrollments?.map((e) => e.id) ?? []

      let taskQuery = client
        .from('player_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .in('enrollment_id', enrollmentIds.length > 0 ? enrollmentIds : ['__none__'])

      let spontQuery = client
        .from('spontaneous_entries')
        .select('id', { count: 'exact', head: true })
        .eq('player_id', playerId)

      if (since) {
        taskQuery = taskQuery.gt('completed_at', since)
        spontQuery = spontQuery.gt('created_at', since)
      }

      return Promise.all([taskQuery, spontQuery])
    },

    async getRecentCompletedPlayerTasks(enrollmentIds: string[], limit: number) {
      return getClient()
        .from('player_tasks')
        .select('completed_at, tasks(title, description)')
        .in('enrollment_id', enrollmentIds)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(limit)
    },

    async getRecentSpontaneousEntries(playerId: string, limit: number) {
      return getClient()
        .from('spontaneous_entries')
        .select('created_at, title, description')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(limit)
    },

    async getSpeechById(id: string) {
      return getClient()
        .from('speeches')
        .select('*')
        .eq('id', id)
        .single()
    },

    async createSpeech(data: {
      player_id: string
      title: string
      speech_text?: string
      status?: 'generating' | 'completed' | 'failed'
      fal_request_id?: string
      video_prompt?: string
      mad_lib_data?: Record<string, unknown>
      generation_cost_cents?: number
      model_used?: string
    }) {
      return getClient()
        .from('speeches')
        .insert(data)
        .select()
        .single()
    },

    async deleteSpeech(id: string) {
      return getClient()
        .from('speeches')
        .delete()
        .eq('id', id)
    },

    async updateSpeech(
      id: string,
      data: Partial<{
        title: string
        speech_text: string
        audio_url: string
        duration_seconds: number
        video_url: string
        status: 'generating' | 'completed' | 'failed'
        fal_request_id: string
        video_prompt: string
        mad_lib_data: Record<string, unknown>
        generation_cost_cents: number
        model_used: string
      }>
    ) {
      return getClient()
        .from('speeches')
        .update(data)
        .eq('id', id)
        .select()
        .single()
    },
  }
}
