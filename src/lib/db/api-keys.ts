import type { SupabaseClient } from '@supabase/supabase-js'

export function createApiKeysDb(getClient: () => SupabaseClient) {
  return {
    // --- User API Keys ---

    async getUserApiKey(userId: string, service: string) {
      return getClient()
        .from('user_api_keys')
        .select('*')
        .eq('user_id', userId)
        .eq('service', service)
        .single()
    },

    async upsertUserApiKey(data: {
      user_id: string
      service: string
      encrypted_key: string
    }) {
      return getClient()
        .from('user_api_keys')
        .upsert(data, { onConflict: 'user_id,service' })
        .select()
        .single()
    },

    async deleteUserApiKey(userId: string, service: string) {
      return getClient()
        .from('user_api_keys')
        .delete()
        .eq('user_id', userId)
        .eq('service', service)
    },

    // --- MCP API Keys ---

    async getActiveKeyByHash(keyHash: string) {
      return getClient()
        .from('mcp_api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .is('revoked_at', null)
        .single()
    },

    async getActiveKeysByGuide(guideId: string) {
      return getClient()
        .from('mcp_api_keys')
        .select('*')
        .eq('guide_id', guideId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
    },

    async createMcpApiKey(data: {
      key_hash: string
      key_prefix: string
      owner_type: 'guide' | 'player'
      guide_id: string
      player_id?: string
      label?: string
    }) {
      return getClient()
        .from('mcp_api_keys')
        .insert(data)
        .select()
        .single()
    },

    async revokeMcpApiKey(id: string, guideId: string) {
      return getClient()
        .from('mcp_api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
        .eq('guide_id', guideId)
        .is('revoked_at', null)
        .select()
        .single()
    },

    async revokeAllMcpApiKeys(guideId: string) {
      return getClient()
        .from('mcp_api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('guide_id', guideId)
        .is('revoked_at', null)
    },

    async updateKeyLastUsed(id: string) {
      return getClient()
        .from('mcp_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', id)
    },

    // --- MCP: Search tasks by title ---

    async findCompletedTaskByTitle(playerId: string, title: string) {
      const client = getClient()

      // Search completed player tasks from the last 30 days by title
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString()

      const { data: enrollments } = await client
        .from('enrollments')
        .select('id')
        .eq('player_id', playerId)

      const enrollmentIds = (enrollments ?? []).map(
        (e: { id: string }) => e.id
      )

      if (enrollmentIds.length === 0) return { data: null, error: null }

      return client
        .from('player_tasks')
        .select('*, tasks(*)')
        .in('enrollment_id', enrollmentIds)
        .in('status', ['completed', 'skipped'])
        .gte('completed_at', thirtyDaysAgo)
        .ilike('tasks.title', title)
        .limit(1)
        .single()
    },

    async findSpontaneousEntryByTitle(playerId: string, title: string) {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString()

      return getClient()
        .from('spontaneous_entries')
        .select('*')
        .eq('player_id', playerId)
        .ilike('title', title)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    },
  }
}
