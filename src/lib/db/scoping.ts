import type { SupabaseClient } from '@supabase/supabase-js'

export function createScopingDb(getClient: () => SupabaseClient) {
  const self = {
    // --- Data Scoping ---

    async verifyGuideOwnsPlayer(
      guideId: string,
      playerId: string
    ) {
      const { data } = await getClient()
        .from('players')
        .select('id')
        .eq('id', playerId)
        .eq('guide_id', guideId)
        .single()
      return !!data
    },

    async verifyGuideOwnsPlayerByAuthUserId(
      guideId: string,
      playerAuthUserId: string
    ) {
      const { data } = await getClient()
        .from('players')
        .select('id')
        .eq('auth_user_id', playerAuthUserId)
        .eq('guide_id', guideId)
        .single()
      return !!data
    },

    async verifyGuideOwnsCurriculum(
      guideId: string,
      curriculumId: string
    ) {
      const client = getClient()

      // Curriculum ownership chain: curriculum.user_id → player.auth_user_id → player.guide_id = guideId
      // Also handles direct guide ownership (user_id = guide's auth ID, no masquerade)
      const { data: curriculum } = await client
        .from('curricula')
        .select('user_id')
        .eq('id', curriculumId)
        .single()
      if (!curriculum) return false

      // Check direct ownership (guide created curriculum without masquerading)
      if (curriculum.user_id === guideId) return true

      // Check indirect ownership via player
      const { data: player } = await client
        .from('players')
        .select('id')
        .eq('auth_user_id', curriculum.user_id)
        .eq('guide_id', guideId)
        .single()
      return !!player
    },

    async verifyGuideOwnsEnrollment(
      guideId: string,
      enrollmentId: string
    ) {
      // Enrollment ownership chain: enrollment.player_id → player.guide_id = guideId
      const { data: enrollment } = await getClient()
        .from('enrollments')
        .select('player_id')
        .eq('id', enrollmentId)
        .single()
      if (!enrollment) return false

      return self.verifyGuideOwnsPlayer(guideId, enrollment.player_id)
    },

    // --- Player Data Scoping ---

    /**
     * Verify the authenticated user is a player and return their player record.
     * Central identity check for all player-facing routes.
     */
    async verifyPlayerIdentity(authUserId: string) {
      const { data } = await getClient()
        .from('players')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single()
      return data
    },

    /**
     * Verify a player owns an enrollment. Returns true if the enrollment
     * belongs to the player.
     */
    async verifyPlayerOwnsEnrollment(playerId: string, enrollmentId: string) {
      const { data } = await getClient()
        .from('enrollments')
        .select('id')
        .eq('id', enrollmentId)
        .eq('player_id', playerId)
        .single()
      return !!data
    },

    /**
     * Verify a player owns a player_task (via the enrollment chain).
     * Returns true if the task's enrollment belongs to the player.
     */
    async verifyPlayerOwnsTask(playerId: string, playerTaskId: string) {
      const { data: playerTask } = await getClient()
        .from('player_tasks')
        .select('enrollment_id')
        .eq('id', playerTaskId)
        .single()
      if (!playerTask) return false
      return self.verifyPlayerOwnsEnrollment(playerId, playerTask.enrollment_id)
    },
  }
  return self
}
