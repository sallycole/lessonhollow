import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  playerParam,
  resolvePlayer,
  resolveEnrollment,
  textResult,
  errorResult,
} from '../helpers'
import { READ_ONLY, WRITE } from '../annotations'
import { resolveTimeZone, todayInTimeZone } from '@/lib/date-tz'

export function registerPlanTools(
  server: McpServer,
  guideId: string
) {
  server.tool(
    'get_upcoming_tasks',
    "Preview the next pending tasks in a player's curriculum queue — these are the tasks that would be added to today next. Optionally filter to one curriculum.",
    {
      player: playerParam,
      curriculum: z
        .string()
        .optional()
        .describe('Curriculum name or ID to filter by'),
      limit: z
        .number()
        .optional()
        .describe('Number of tasks to return. Defaults to 5.'),
    },
    READ_ONLY,
    async ({ player: input, curriculum: currInput, limit }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const taskLimit = limit ?? 5

        if (currInput) {
          const enrollment = await resolveEnrollment(
            guideId,
            player.id,
            currInput
          )
          const { data: upcoming } = await db.getUpcomingTasks(
            enrollment.id,
            taskLimit
          )

          if (!upcoming || upcoming.length === 0)
            return textResult('No upcoming tasks.')

          return textResult(
            (
              upcoming as Array<{
                taskTitle: string
                status: string
                taskId: string
              }>
            )
              .map(
                (t, i) =>
                  `${i + 1}. ${t.taskTitle}${t.status === 'promoted' ? ' [planned]' : ''}`
              )
              .join('\n')
          )
        }

        // All enrollments
        const { data: enrollments } =
          await db.getEnrollmentsByPlayer(player.id)
        const active = (
          (enrollments ?? []) as Array<{
            id: string
            curriculum_id: string
            status: string
            start_date?: string
          }>
        ).filter((e) => e.status === 'active')

        const todayStr = todayInTimeZone(resolveTimeZone(player.time_zone))
        const lines: string[] = []
        for (const enrollment of active) {
          const { data: curriculum } = await db.getCurriculumById(
            enrollment.curriculum_id
          )
          const currName =
            (curriculum as { name: string } | null)?.name ??
            'Unknown'
          const { data: upcoming } = await db.getUpcomingTasks(
            enrollment.id,
            taskLimit
          )
          if (upcoming && upcoming.length > 0) {
            const startsNote =
              enrollment.start_date && enrollment.start_date > todayStr
                ? ` (starts ${enrollment.start_date})`
                : ''
            lines.push(`\n${currName}${startsNote}:`)
            for (const t of upcoming as Array<{
              taskTitle: string
              status: string
            }>) {
              lines.push(
                `  - ${t.taskTitle}${t.status === 'promoted' ? ' [planned]' : ''}`
              )
            }
          }
        }

        return textResult(
          lines.length > 0
            ? lines.join('\n')
            : 'No upcoming tasks.'
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to get upcoming tasks.'
        )
      }
    }
  )

  server.tool(
    'plan_tasks',
    "Add pending tasks to a player's Today queue. Use this when the user wants to plan today's work, queue up tasks, or move tasks from a curriculum into today's to-do list.",
    {
      player: playerParam,
      curriculum: z
        .string()
        .optional()
        .describe(
          'Curriculum name or ID. Used with count to add the next N tasks to today.'
        ),
      count: z
        .number()
        .optional()
        .describe(
          'Number of next tasks to add to today. Defaults to 1. Used with curriculum.'
        ),
      task_ids: z
        .array(z.string())
        .optional()
        .describe(
          'Specific task IDs to add to today. Use this OR curriculum+count.'
        ),
    },
    WRITE,
    async ({ player: input, curriculum: currInput, count, task_ids }) => {
      try {
        const player = await resolvePlayer(guideId, input)

        if (task_ids && task_ids.length > 0) {
          let promoted = 0
          for (const taskId of task_ids) {
            const { data: enrollments } =
              await db.getEnrollmentsByPlayer(player.id)
            const activeEnrollments = (
              (enrollments ?? []) as Array<{
                id: string
                status: string
              }>
            ).filter((e) => e.status === 'active')

            for (const enrollment of activeEnrollments) {
              const { data: upcoming } =
                await db.getUpcomingTasks(enrollment.id, 100)
              const match = (upcoming ?? []).find(
                (t: { taskId: string }) => t.taskId === taskId
              )
              if (match) {
                await db.promoteTask(
                  enrollment.id,
                  taskId,
                  (match as { loopNumber: number }).loopNumber
                )
                promoted++
                break
              }
            }
          }
          return textResult(
            `Added ${promoted} tasks to today for ${player.first_name}.`
          )
        }

        if (currInput) {
          const enrollment = await resolveEnrollment(
            guideId,
            player.id,
            currInput
          )
          const n = count ?? 1
          const { data: upcoming } = await db.getUpcomingTasks(
            enrollment.id,
            n
          )

          if (!upcoming || upcoming.length === 0) {
            return textResult('No pending tasks available to add to today.')
          }

          let promoted = 0
          for (const t of upcoming as Array<{
            taskId: string
            status: string
            loopNumber: number
          }>) {
            if (t.status === 'pending') {
              await db.promoteTask(
                enrollment.id,
                t.taskId,
                t.loopNumber
              )
              promoted++
            }
          }
          return textResult(
            `Added ${promoted} tasks to today for ${player.first_name}.`
          )
        }

        return errorResult(
          'Provide either task_ids or curriculum (with optional count).'
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to add tasks to today.'
        )
      }
    }
  )
}
