import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getEffectiveUser } from '@/lib/masquerade'
import { generateCsv, sanitizeFilename, UTF8_BOM } from '@/lib/csv-export'
import { checkApiRateLimit } from '@/lib/rate-limit'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { user, response: authResponse } = await requireAuth()
    if (authResponse) return authResponse

    // General API: 100 requests per user per minute
    const rateLimited = checkApiRateLimit(user.id, 'export')
    if (rateLimited) return rateLimited

    const effectiveUser = await getEffectiveUser()
    if (!effectiveUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: curriculum } = await db.getCurriculumById(id)
    if (!curriculum || curriculum.user_id !== effectiveUser.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: tasks } = await db.getTasksByCurriculum(id)

    const csv = generateCsv(
      {
        name: curriculum.name as string,
        description: curriculum.description as string | null,
        resource_url: curriculum.resource_url as string | null,
        publisher: curriculum.publisher as string | null,
        grade_level: curriculum.grade_level as string | null,
      },
      (tasks ?? []).map((t) => ({
        title: t.title as string,
        description: t.description as string | null,
        action_type: t.action_type as string,
        resource_url: t.resource_url as string | null,
      }))
    )

    const date = new Date().toISOString().slice(0, 10)
    const filename = `${sanitizeFilename(curriculum.name as string)}-${date}.csv`

    return new Response(UTF8_BOM + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
