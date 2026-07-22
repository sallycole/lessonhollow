import type { SupabaseClient } from '@supabase/supabase-js'

export function createDiscoveryDb(getClient: () => SupabaseClient) {
  return {
    async getPublicCurricula(
      page: number = 1,
      pageSize: number = 24,
      sort: 'recent' | 'copies' = 'recent'
    ) {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const orderCol = sort === 'copies' ? 'copy_count' : 'published_at'
      return getClient()
        .from('curricula')
        .select('*, tasks(count)', { count: 'exact' })
        .eq('is_public', true)
        .order(orderCol, { ascending: false })
        .range(from, to)
    },

    async getPublicCurriculumById(id: string) {
      return getClient()
        .from('curricula')
        .select('*, tasks(*)')
        .eq('id', id)
        .eq('is_public', true)
        .single()
    },

    async getPublicCurriculumWithTasks(id: string) {
      const curriculumResult = await getClient()
        .from('curricula')
        .select('*, tasks(count)')
        .eq('id', id)
        .eq('is_public', true)
        .single()

      if (curriculumResult.error || !curriculumResult.data) {
        return { curriculum: curriculumResult, tasks: { data: [], error: null } }
      }

      const taskCount = (curriculumResult.data.tasks as { count: number }[])?.[0]?.count ?? 0

      // Supabase caps at 1000 rows per request — paginate for large curricula
      const PAGE = 1000
      const pages = Math.ceil(taskCount / PAGE)
      const fetches = Array.from({ length: pages }, (_, i) =>
        getClient()
          .from('tasks')
          .select('id, title, description, action_type, resource_url, position')
          .eq('curriculum_id', id)
          .order('position')
          .range(i * PAGE, (i + 1) * PAGE - 1)
      )
      const results = await Promise.all(fetches)
      const allTasks = results.flatMap((r) => r.data ?? [])
      const firstError = results.find((r) => r.error)?.error ?? null

      return {
        curriculum: curriculumResult,
        tasks: { data: allTasks, error: firstError },
      }
    },

    async getCopyByOriginalIdAndUser(originalId: string, userId: string) {
      return getClient()
        .from('curricula')
        .select('id, name, created_at, updated_at')
        .eq('original_id', originalId)
        .eq('user_id', userId)
        .maybeSingle()
    },

    async adoptPublicCurriculum(
      sourceCurriculumId: string,
      targetUserId: string,
      nameOverride?: string
    ): Promise<{ data: { id: string } | null; error: string | null }> {
      const client = getClient()

      // 1. Fetch and verify the source is public
      const { data: source, error: sourceErr } = await client
        .from('curricula')
        .select('*, tasks(count)')
        .eq('id', sourceCurriculumId)
        .eq('is_public', true)
        .single()

      if (sourceErr || !source) {
        return { data: null, error: 'This curriculum is no longer available.' }
      }

      // 2. Create the private copy (trigger auto-increments copy_count via original_id)
      const { data: newCurriculum, error: insertErr } = await client
        .from('curricula')
        .insert({
          user_id: targetUserId,
          name: nameOverride || source.public_title || source.name,
          description: source.description || '',
          resource_url: source.resource_url || '',
          publisher: source.publisher || '',
          grade_level: source.grade_level || null,
          original_id: source.id,
          is_public: false,
        })
        .select('id')
        .single()

      if (insertErr || !newCurriculum) {
        return { data: null, error: 'Failed to copy curriculum.' }
      }

      // 3. Fetch all tasks with pagination (Supabase caps at 1000 per request)
      const taskCount = (source.tasks as { count: number }[])?.[0]?.count ?? 0
      const PAGE = 1000
      const pages = Math.ceil(taskCount / PAGE)
      const fetches = Array.from({ length: pages }, (_, i) =>
        client
          .from('tasks')
          .select('title, description, action_type, resource_url, position')
          .eq('curriculum_id', sourceCurriculumId)
          .order('position')
          .range(i * PAGE, (i + 1) * PAGE - 1)
      )
      const results = await Promise.all(fetches)
      const allTasks = results.flatMap((r) => r.data ?? [])

      // 4. Bulk-insert tasks in batches of 500
      const BATCH = 500
      for (let i = 0; i < allTasks.length; i += BATCH) {
        const batch = allTasks.slice(i, i + BATCH).map((t) => ({
          curriculum_id: newCurriculum.id,
          title: t.title,
          description: t.description || '',
          action_type: t.action_type,
          resource_url: t.resource_url || '',
          position: t.position,
        }))
        const { error: batchErr } = await client.from('tasks').insert(batch)
        if (batchErr) {
          // Clean up the orphaned curriculum
          await client.from('curricula').delete().eq('id', newCurriculum.id)
          return { data: null, error: 'Failed to copy tasks.' }
        }
      }

      return { data: { id: newCurriculum.id }, error: null }
    },
  }
}
