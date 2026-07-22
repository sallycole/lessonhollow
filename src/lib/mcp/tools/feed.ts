import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  playerParam,
  resolvePlayer,
  resolveTaskItem,
  textResult,
  errorResult,
} from '../helpers'
import { READ_ONLY, WRITE, WRITE_IDEMPOTENT } from '../annotations'
import { dateKeyInTimeZone, resolveTimeZone, todayInTimeZone } from '@/lib/date-tz'

function getDateRange(
  range: 'daily' | 'weekly' | 'monthly' | 'yearly',
  dateStr: string
): { start: string; end: string } {
  const date = new Date(dateStr + 'T00:00:00')
  const year = date.getFullYear()
  const month = date.getMonth()

  switch (range) {
    case 'daily':
      return { start: dateStr, end: dateStr }
    case 'weekly': {
      const day = date.getDay()
      const mondayOffset = day === 0 ? -6 : 1 - day
      const monday = new Date(date)
      monday.setDate(date.getDate() + mondayOffset)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return {
        start: monday.toISOString().split('T')[0],
        end: sunday.toISOString().split('T')[0],
      }
    }
    case 'monthly': {
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0],
      }
    }
    case 'yearly':
      return { start: `${year}-01-01`, end: `${year}-12-31` }
  }
}

export function registerFeedTools(
  server: McpServer,
  guideId: string
) {
  server.tool(
    'get_log',
    "View a player's completed work and logged activities over a date range. Use this to answer \"what did they do today/this week/this month\" or to review learning history.",
    {
      player: playerParam,
      range: z
        .enum(['daily', 'weekly', 'monthly', 'yearly'])
        .optional()
        .describe('Time range. Defaults to daily.'),
      date: z
        .string()
        .optional()
        .describe(
          'Reference date (ISO 8601). Defaults to today.'
        ),
    },
    READ_ONLY,
    async ({ player: input, range, date }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const timeZone = resolveTimeZone(player.time_zone)
        const rangeVal = range ?? 'daily'
        // A bare YYYY-MM-DD is taken literally; a full timestamp is resolved to
        // its calendar day in the player's zone; no date defaults to their today.
        const dateStr = date
          ? /^\d{4}-\d{2}-\d{2}$/.test(date)
            ? date
            : dateKeyInTimeZone(date, timeZone)
          : todayInTimeZone(timeZone)

        const { start, end } = getDateRange(rangeVal, dateStr)
        const { data, error } = await db.getFeedItems(
          player.id,
          start,
          end,
          timeZone
        )
        if (error) return errorResult('Failed to fetch feed.')

        type FeedTask = {
          status: string
          time_spent_minutes: number
          notes: string | null
          tasks: { title: string; action_type: string }
          enrollments: { curricula: { name: string } }
        }
        type FeedSpont = {
          title: string
          action_type: string
          time_spent_minutes: number
          notes: string | null
        }

        const tasks = (data?.tasks ?? []) as FeedTask[]
        const spontaneous = (data?.spontaneous ?? []) as FeedSpont[]

        if (tasks.length === 0 && spontaneous.length === 0) {
          return textResult(
            `No activity for ${player.first_name} (${start} to ${end}).`
          )
        }

        const lines: string[] = [
          `${player.first_name}'s log (${start} to ${end}):`,
        ]

        if (tasks.length > 0) {
          lines.push('\nCurriculum tasks:')
          for (const t of tasks) {
            const marker =
              t.status === 'skipped' ? ' [skipped]' : ''
            const time = t.time_spent_minutes
              ? ` (${Math.round(t.time_spent_minutes)}m)`
              : ''
            lines.push(
              `- ${t.tasks.title} [${t.tasks.action_type}] — ${t.enrollments?.curricula?.name}${time}${marker}`
            )
            if (t.notes) lines.push(`  Notes: ${t.notes}`)
          }
        }

        if (spontaneous.length > 0) {
          lines.push('\nSpontaneous:')
          for (const s of spontaneous) {
            const time = s.time_spent_minutes
              ? ` (${Math.round(s.time_spent_minutes)}m)`
              : ''
            lines.push(
              `- ${s.title} [${s.action_type}]${time}`
            )
            if (s.notes) lines.push(`  Notes: ${s.notes}`)
          }
        }

        return textResult(lines.join('\n'))
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to get log.'
        )
      }
    }
  )

  server.tool(
    'add_task_notes',
    'Add or update notes on a completed task.',
    {
      player: playerParam,
      task: z
        .string()
        .describe('Task title or player_task ID'),
      notes: z.string().describe('Notes text'),
    },
    WRITE_IDEMPOTENT,
    async ({ player: input, task: taskInput, notes }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const trimmedNotes = notes.trim()
        if (!trimmedNotes) return errorResult('notes is required.')

        const item = await resolveTaskItem(player.id, taskInput)
        if (item.type === 'task') {
          await db.updatePlayerTask(item.id, {
            notes: trimmedNotes,
          })
        } else {
          await db.updateSpontaneousEntry(item.id, {
            notes: trimmedNotes,
          })
        }
        return textResult(
          `Updated notes for ${player.first_name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to update notes.'
        )
      }
    }
  )

  server.tool(
    'log_activity',
    "Log a learning activity that isn't part of a curriculum — e.g. a field trip, documentary, or independent project. Use this when the user wants to record, log, or track something the player did outside their enrolled coursework.",
    {
      player: playerParam,
      title: z
        .string()
        .describe('Title of the learning activity'),
      started_at: z
        .string()
        .describe('ISO 8601 start date/time'),
      ended_at: z
        .string()
        .describe('ISO 8601 end date/time'),
      description: z
        .string()
        .optional()
        .describe('Description of the activity'),
      action_type: z
        .enum(['Read', 'Watch', 'Listen', 'Do'])
        .optional()
        .describe('What the player did: Read, Watch, Listen, or Do. Defaults to Do.'),
      resource_url: z
        .string()
        .optional()
        .describe('URL of the resource used'),
      notes: z
        .string()
        .optional()
        .describe('Notes about the activity'),
    },
    WRITE,
    async (args) => {
      try {
        const player = await resolvePlayer(guideId, args.player)

        const title = args.title.trim()
        if (!title) return errorResult('Title is required.')
        if (title.length > 200)
          return errorResult(
            'Title must be 200 characters or less.'
          )

        const startMs = new Date(args.started_at).getTime()
        const endMs = new Date(args.ended_at).getTime()
        if (isNaN(startMs) || isNaN(endMs)) {
          return errorResult(
            'Invalid date format. Use ISO 8601 (e.g. 2025-03-15T14:00:00Z).'
          )
        }
        if (endMs <= startMs) {
          return errorResult(
            'ended_at must be after started_at.'
          )
        }
        const timeSpentMinutes = Math.round(
          (endMs - startMs) / 60000
        )

        const description = args.description?.trim() || undefined
        if (description && description.length > 1000) {
          return errorResult(
            'Description must be 1000 characters or less.'
          )
        }

        const actionType = args.action_type ?? 'Do'

        const { data: entry, error } =
          await db.createSpontaneousEntry({
            player_id: player.id,
            title,
            description,
            action_type: actionType,
            resource_url: args.resource_url?.trim() || undefined,
            time_spent_minutes: timeSpentMinutes,
            started_at: args.started_at,
            ended_at: args.ended_at,
            notes: args.notes?.trim() || undefined,
          })

        if (error)
          return errorResult(
            'Failed to create spontaneous entry: ' +
              error.message
          )

        return textResult(
          `Logged "${title}" for ${player.first_name} (${timeSpentMinutes} min, ${actionType}).`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to log entry.'
        )
      }
    }
  )
}
