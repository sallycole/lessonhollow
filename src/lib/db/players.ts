import type { SupabaseClient } from '@supabase/supabase-js'

export function createPlayersDb(getClient: () => SupabaseClient) {
  return {
    async getPlayersByGuide(guideId: string) {
      return getClient()
        .from('players')
        .select('*')
        .eq('guide_id', guideId)
        .order('created_at')
    },

    async getPlayerById(id: string) {
      return getClient()
        .from('players')
        .select('*')
        .eq('id', id)
        .single()
    },

    async getPlayerByAuthUserId(authUserId: string) {
      return getClient()
        .from('players')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single()
    },

    async getPlayerByUsername(username: string) {
      return getClient()
        .from('players')
        .select('*')
        .eq('username', username)
        .single()
    },

    async getPlayerByUsernameCaseInsensitive(username: string) {
      return getClient()
        .from('players')
        .select('*')
        .ilike('username', username)
        .single()
    },

    async getPlayerCountByGuide(guideId: string) {
      return getClient()
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('guide_id', guideId)
    },

    async createPlayer(data: {
      guide_id: string
      username: string
      first_name: string
      last_name: string
      time_zone: string
      encrypted_password?: string
      auth_user_id?: string
      video_tasks_required?: number
      is_guide_player?: boolean
    }) {
      return getClient()
        .from('players')
        .insert(data)
        .select()
        .single()
    },

    async updatePlayer(
      id: string,
      data: Partial<{
        username: string
        first_name: string
        last_name: string
        time_zone: string
        encrypted_password: string
        auth_user_id: string
        video_tasks_required: number
        player_password_set_at: string
      }>
    ) {
      return getClient()
        .from('players')
        .update(data)
        .eq('id', id)
        .select()
        .single()
    },

    async updatePlayersByGuide(
      guideId: string,
      data: Partial<{ video_tasks_required: number }>
    ) {
      return getClient()
        .from('players')
        .update(data)
        .eq('guide_id', guideId)
    },

    async deletePlayer(id: string) {
      return getClient()
        .from('players')
        .delete()
        .eq('id', id)
    },

    // --- Bulk Player Deletion (for consent revocation / account deletion) ---

    /**
     * Delete all players belonging to a guide, including storage files.
     * Returns the list of auth_user_ids that need to be deleted from Supabase Auth.
     * DB cascades handle: enrollments, player_tasks, spontaneous_entries, speeches, user_api_keys.
     * Storage cleanup (fox-songs, task-photos) must be done explicitly.
     */
    async deleteAllPlayersForGuide(guideId: string): Promise<{
      authUserIds: string[]
      error: string | null
    }> {
      const client = getClient()

      // 1. Get all players for this guide
      const { data: players, error: fetchErr } = await client
        .from('players')
        .select('id, auth_user_id')
        .eq('guide_id', guideId)

      if (fetchErr) {
        return { authUserIds: [], error: fetchErr.message }
      }

      if (!players || players.length === 0) {
        return { authUserIds: [], error: null }
      }

      // 2. Clean up storage files for each player
      for (const player of players) {
        // Delete fox song files
        const { data: foxFiles } = await client.storage
          .from('fox-songs')
          .list(player.id)
        if (foxFiles && foxFiles.length > 0) {
          const foxPaths = foxFiles.map((f) => `${player.id}/${f.name}`)
          await client.storage.from('fox-songs').remove(foxPaths)
        }

        // Delete task photo files
        const { data: photoFiles } = await client.storage
          .from('task-photos')
          .list(player.id)
        if (photoFiles && photoFiles.length > 0) {
          const photoPaths = photoFiles.map((f) => `${player.id}/${f.name}`)
          await client.storage.from('task-photos').remove(photoPaths)
        }
      }

      // 3. Collect auth user IDs before deletion
      const authUserIds = players
        .map((p) => p.auth_user_id)
        .filter((id): id is string => id != null)

      // 4. Delete all player records (cascades handle related tables)
      const { error: deleteErr } = await client
        .from('players')
        .delete()
        .eq('guide_id', guideId)

      if (deleteErr) {
        return { authUserIds: [], error: deleteErr.message }
      }

      return { authUserIds, error: null }
    },
  }
}
