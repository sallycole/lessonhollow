import type { SupabaseClient } from '@supabase/supabase-js'

export function createTasksDb(getClient: () => SupabaseClient) {
  return {
    async getTasksByCurriculum(curriculumId: string) {
      const client = getClient()

      // Supabase caps at 1000 rows per request — count first, then paginate
      // so curricula with >1000 tasks come back complete (mirrors discovery.ts).
      const { count } = await client
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('curriculum_id', curriculumId)

      const PAGE = 1000
      const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))
      const fetches = Array.from({ length: pages }, (_, i) =>
        client
          .from('tasks')
          .select('*')
          .eq('curriculum_id', curriculumId)
          .order('position')
          .range(i * PAGE, (i + 1) * PAGE - 1)
      )
      const results = await Promise.all(fetches)
      const firstError = results.find((r) => r.error)?.error ?? null
      const data = firstError ? null : results.flatMap((r) => r.data ?? [])
      return { data, error: firstError }
    },

    async getTaskCountByCurriculum(curriculumId: string) {
      const { count } = await getClient()
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('curriculum_id', curriculumId)
      return count ?? 0
    },

    async getMaxTaskPosition(curriculumId: string) {
      const { data } = await getClient()
        .from('tasks')
        .select('position')
        .eq('curriculum_id', curriculumId)
        .order('position', { ascending: false })
        .limit(1)
        .single()
      return data?.position ?? 0
    },

    async getTaskById(id: string) {
      return getClient()
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single()
    },

    async createTask(data: {
      curriculum_id: string
      title: string
      description?: string
      action_type: 'Read' | 'Watch' | 'Listen' | 'Do'
      resource_url?: string
      position: number
    }) {
      return getClient()
        .from('tasks')
        .insert(data)
        .select()
        .single()
    },

    async createTasks(data: Array<{
      curriculum_id: string
      title: string
      description?: string
      action_type: 'Read' | 'Watch' | 'Listen' | 'Do'
      resource_url?: string
      position: number
    }>) {
      return getClient()
        .from('tasks')
        .insert(data)
        .select()
    },

    async updateTask(
      id: string,
      data: Partial<{
        title: string
        description: string
        action_type: 'Read' | 'Watch' | 'Listen' | 'Do'
        resource_url: string
        position: number
      }>
    ) {
      return getClient()
        .from('tasks')
        .update(data)
        .eq('id', id)
        .select()
        .single()
    },

    async shiftTaskPositionsAfter(curriculumId: string, afterPosition: number) {
      const client = getClient()

      // Get all tasks with position > afterPosition, ordered descending
      // so we update from highest to lowest to avoid conflicts
      const { data: tasks } = await client
        .from('tasks')
        .select('id, position')
        .eq('curriculum_id', curriculumId)
        .gt('position', afterPosition)
        .order('position', { ascending: false })

      if (!tasks || tasks.length === 0) return { error: null }

      const results = await Promise.all(
        tasks.map(({ id, position }) =>
          client
            .from('tasks')
            .update({ position: position + 10 })
            .eq('id', id)
        )
      )
      const firstError = results.find((r) => r.error)
      return { error: firstError?.error ?? null }
    },

    async updateTaskPositions(updates: Array<{ id: string; position: number }>) {
      const client = getClient()
      const results = await Promise.all(
        updates.map(({ id, position }) =>
          client
            .from('tasks')
            .update({ position })
            .eq('id', id)
        )
      )
      const firstError = results.find((r) => r.error)
      return { error: firstError?.error ?? null }
    },

    async deleteTask(id: string) {
      return getClient()
        .from('tasks')
        .delete()
        .eq('id', id)
    },
  }
}
