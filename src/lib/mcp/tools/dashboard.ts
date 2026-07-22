import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '@/lib/db'
import { computeQuantitativePacing } from '@/lib/daily-goal'
import { resolveTimeZone, todayInTimeZone } from '@/lib/date-tz'
import {
  playerParam,
  resolvePlayer,
  getPlayersForGuide,
  textResult,
  errorResult,
} from '../helpers'
import { READ_ONLY } from '../annotations'

export function registerDashboardTools(
  server: McpServer,
  guideId: string
) {
  server.tool(
    'get_dashboard',
    'Overview of all players with their enrollments, pacing, and completion stats.',
    {},
    READ_ONLY,
    async () => {
      try {
        const players = await getPlayersForGuide(guideId)
        const sections: string[] = []

        for (const player of players) {
          const todayKey = todayInTimeZone(resolveTimeZone(player.time_zone))
          const { data: enrollments } =
            await db.getEnrollmentsByPlayer(player.id)
          const activeEnrollments = (
            (enrollments ?? []) as Array<{
              id: string
              curriculum_id: string
              enrollment_type: string
              status: string
              target_completion_date?: string
              start_date?: string
              created_at: string
            }>
          ).filter((e) => e.status === 'active')

          if (activeEnrollments.length === 0) {
            sections.push(
              `== ${player.first_name} ==\nNo active enrollments.`
            )
            continue
          }

          const lines: string[] = [`== ${player.first_name} ==`]
          for (const enrollment of activeEnrollments) {
            const stats = await db.getEnrollmentStats(enrollment.id, todayKey)
            const { data: curriculum } = await db.getCurriculumById(
              enrollment.curriculum_id
            )
            const name =
              (curriculum as { name: string } | null)?.name ??
              'Unknown'

            if (stats.data) {
              const pacing = computeQuantitativePacing({
                completed: stats.data.doneTasks,
                total: stats.data.totalTasks,
                startDate: (enrollment.start_date ?? enrollment.created_at).split('T')[0],
                targetDate:
                  enrollment.target_completion_date ?? null,
                today: todayKey,
              })

              const pct = stats.data.percentComplete
              const pacingLabel =
                pacing.status === 'ongoing'
                  ? ''
                  : pacing.status === 'on-track'
                    ? ' — on track'
                    : pacing.status === 'ahead'
                      ? ` — ahead by ${pacing.tasksDelta}`
                      : pacing.status === 'behind'
                        ? ` — behind by ${Math.abs(pacing.tasksDelta)}`
                        : ' — overdue'

              const target = enrollment.target_completion_date
                ? ` — target: ${enrollment.target_completion_date}`
                : ''

              lines.push(
                `- ${name} (${enrollment.enrollment_type}) — ${stats.data.doneTasks}/${stats.data.totalTasks} tasks (${pct}%)${pacingLabel}${target}`
              )
            }
          }
          sections.push(lines.join('\n'))
        }

        return textResult(
          sections.join('\n\n') || 'No players found.'
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to get dashboard.'
        )
      }
    }
  )

  server.tool(
    'get_player_enrollments',
    'Detailed enrollment info for a player (student/learner) including pacing and completion stats.',
    {
      player: playerParam,
      status: z
        .enum(['active', 'paused', 'finished'])
        .optional()
        .describe('Filter by status. Defaults to active.'),
    },
    READ_ONLY,
    async ({ player: input, status }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const todayKey = todayInTimeZone(resolveTimeZone(player.time_zone))
        const statusFilter = status ?? 'active'

        const { data: enrollments } =
          await db.getEnrollmentsByPlayer(player.id)
        const filtered = (
          (enrollments ?? []) as Array<{
            id: string
            curriculum_id: string
            enrollment_type: string
            status: string
            target_completion_date?: string
            study_days_per_week?: number
            target_loops?: number
            start_date?: string
            created_at: string
          }>
        ).filter((e) => e.status === statusFilter)

        if (filtered.length === 0) {
          return textResult(
            `No ${statusFilter} enrollments for ${player.first_name}.`
          )
        }

        const lines: string[] = [
          `${player.first_name}'s ${statusFilter} enrollments:`,
        ]
        for (const enrollment of filtered) {
          const stats = await db.getEnrollmentStats(enrollment.id, todayKey)
          const { data: curriculum } = await db.getCurriculumById(
            enrollment.curriculum_id
          )
          const name =
            (curriculum as { name: string } | null)?.name ??
            'Unknown'

          if (stats.data) {
            const pacing = computeQuantitativePacing({
              completed: stats.data.doneTasks,
              total: stats.data.totalTasks,
              startDate: (enrollment.start_date ?? enrollment.created_at).split('T')[0],
              targetDate:
                enrollment.target_completion_date ?? null,
              today: todayKey,
            })

            lines.push(`\n${name} (${enrollment.enrollment_type})`)
            lines.push(
              `  Progress: ${stats.data.doneTasks}/${stats.data.totalTasks} (${stats.data.percentComplete}%)`
            )
            lines.push(
              `  Time spent: ${stats.data.totalTimeMinutes} min`
            )
            if (enrollment.target_completion_date)
              lines.push(
                `  Target: ${enrollment.target_completion_date}`
              )
            if (enrollment.study_days_per_week)
              lines.push(
                `  Study days/week: ${enrollment.study_days_per_week}`
              )
            lines.push(
              `  Pacing: ${pacing.status}${pacing.tasksDelta !== 0 ? ` (${pacing.tasksDelta > 0 ? '+' : ''}${pacing.tasksDelta} tasks)` : ''}`
            )
            if (stats.data.completedLoops !== undefined) {
              lines.push(
                `  Loops: ${stats.data.completedLoops}/${stats.data.targetLoops}`
              )
            }
          }
        }
        return textResult(lines.join('\n'))
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to get enrollments.'
        )
      }
    }
  )
}
