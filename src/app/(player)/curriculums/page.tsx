import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getEffectiveUser } from '@/lib/masquerade'
import { Plus } from 'lucide-react'
import { CurriculumsList, type CurriculumListItem } from './curriculums-list'

export const dynamic = 'force-dynamic'

export default async function CurriculumsPage() {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) redirect('/login')

  let playerId: string | undefined
  if (effectiveUser.isMasquerading && effectiveUser.playerId) {
    playerId = effectiveUser.playerId
  } else {
    const { data: player } = await db.getPlayerByAuthUserId(effectiveUser.userId)
    playerId = player?.id
  }

  const { data: ownedData } = await db.getCurriculaWithTaskCountByUser(effectiveUser.userId)

  type EnrolledRow = { curriculum_id: unknown; curricula: unknown }
  let enrolledRows: EnrolledRow[] = []
  const enrolledIds = new Set<string>()
  if (playerId) {
    const { data: enrolledData } = await db.getEnrolledCurriculaWithTaskCount(playerId)
    enrolledRows = (enrolledData ?? []) as EnrolledRow[]
    for (const e of enrolledRows) {
      enrolledIds.add(e.curriculum_id as string)
    }
  }

  const curriculaMap = new Map<string, CurriculumListItem>()

  for (const c of ownedData ?? []) {
    const tasks = c.tasks as unknown as Array<{ count: number }> | undefined
    const taskCount = tasks?.[0]?.count ?? 0
    curriculaMap.set(c.id as string, {
      id: c.id as string,
      name: c.name as string,
      description: (c.description as string | null) ?? null,
      publisher: (c.publisher as string | null) ?? null,
      grade_level: c.grade_level as string | null,
      task_count: taskCount,
      created_at: c.created_at as string,
      is_enrolled: enrolledIds.has(c.id as string),
    })
  }

  for (const e of enrolledRows) {
    const curriculum = e.curricula as unknown as Record<string, unknown> | null
    if (!curriculum) continue
    const cId = curriculum.id as string
    if (curriculaMap.has(cId)) continue
    const tasks = curriculum.tasks as unknown as Array<{ count: number }> | undefined
    const taskCount = tasks?.[0]?.count ?? 0
    curriculaMap.set(cId, {
      id: cId,
      name: curriculum.name as string,
      description: (curriculum.description as string | null) ?? null,
      publisher: (curriculum.publisher as string | null) ?? null,
      grade_level: curriculum.grade_level as string | null,
      task_count: taskCount,
      created_at: curriculum.created_at as string,
      is_enrolled: true,
    })
  }

  const curricula = Array.from(curriculaMap.values())

  return (
    <div className="curriculums-shell">
      <header className="page-header-with-action">
        <hgroup>
          <h1>Curriculums</h1>
          <p>All your curriculums in one place.</p>
        </hgroup>
        <Link href="/curriculums/new" role="button" className="outline">
          <Plus size={16} /> Create Curriculum
        </Link>
      </header>

      <CurriculumsList curricula={curricula} />
    </div>
  )
}
