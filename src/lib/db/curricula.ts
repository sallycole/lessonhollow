import type { SupabaseClient } from '@supabase/supabase-js'
import type { GradeLevel } from '../constants'

export function createCurriculaDb(getClient: () => SupabaseClient) {
  return {
    async getCurriculaByUser(userId: string) {
      return getClient()
        .from('curricula')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    },

    async getCurriculaByUserIds(userIds: string[]) {
      return getClient()
        .from('curricula')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
    },

    async getCurriculaWithTaskCountByUserIds(userIds: string[]) {
      return getClient()
        .from('curricula')
        .select('*, tasks(count)')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
    },

    async getCurriculaWithTaskCountByUser(userId: string) {
      return getClient()
        .from('curricula')
        .select('*, tasks(count)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    },

    async getEnrolledCurriculaWithTaskCount(playerId: string) {
      return getClient()
        .from('enrollments')
        .select('curriculum_id, curricula(*, tasks(count))')
        .eq('player_id', playerId)
    },

    async getCurriculumById(id: string) {
      return getClient()
        .from('curricula')
        .select('*')
        .eq('id', id)
        .single()
    },

    async createCurriculum(data: {
      user_id: string
      name: string
      description?: string
      resource_url?: string
      publisher?: string
      grade_level?: GradeLevel | null
    }) {
      // Curricula created by the admin player are automatically published.
      // The admin's player auth user ID is set via ADMIN_PLAYER_AUTH_USER_ID
      // env var. Any other user's curricula stay private. Admin uploads also
      // get their public_title and public_description seeded from the CSV
      // metadata so the discover gallery card has copy to show without
      // anyone needing to edit the row by hand later.
      const adminAuthId = process.env.ADMIN_PLAYER_AUTH_USER_ID
      const isAdminUpload = !!adminAuthId && data.user_id === adminAuthId

      // public_description has a 280 char DB constraint. Truncate at the
      // nearest word boundary if the source description is longer.
      const truncate = (s: string | undefined, max = 280): string | null => {
        if (!s) return null
        if (s.length <= max) return s
        const cutoff = max - 1 // leave room for an ellipsis
        const slice = s.slice(0, cutoff)
        const lastSpace = slice.lastIndexOf(' ')
        return (lastSpace > max - 40 ? slice.slice(0, lastSpace) : slice) + '\u2026'
      }

      const insertData = isAdminUpload
        ? {
            ...data,
            is_public: true,
            published_at: new Date().toISOString(),
            public_title: data.name,
            public_description: truncate(data.description),
          }
        : data

      return getClient()
        .from('curricula')
        .insert(insertData)
        .select()
        .single()
    },

    async updateCurriculum(
      id: string,
      data: Partial<{
        name: string
        description: string
        resource_url: string
        publisher: string
        grade_level: GradeLevel | null
      }>
    ) {
      return getClient()
        .from('curricula')
        .update(data)
        .eq('id', id)
        .select()
        .single()
    },

    async deleteCurriculum(id: string) {
      return getClient()
        .from('curricula')
        .delete()
        .eq('id', id)
    },
  }
}
