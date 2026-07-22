'use server'

import { db } from '@/lib/db'

export async function loadMoreCurricula(
  page: number,
  sort: 'recent' | 'copies' = 'recent'
) {
  try {
    const { data, error, count } = await db.getPublicCurricula(page, 24, sort)
    if (error) {
      return { curricula: [], total: 0 }
    }
    return { curricula: data ?? [], total: count ?? 0 }
  } catch {
    return { curricula: [], total: 0 }
  }
}
