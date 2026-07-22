import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  playerParam,
  resolvePlayer,
  resolvePromotedTask,
  resolveCompletedTask,
  textResult,
  errorResult,
} from '../helpers'
import { READ_ONLY, WRITE, DESTRUCTIVE } from '../annotations'
import { resolveTimeZone, todayInTimeZone } from '@/lib/date-tz'

export function registerTodayTools(
  server: McpServer,
  guideId: string
) {
  server.tool(
    'get_today',
    "Get a player's task list for today with full details: titles, resource URLs, timer status, and notes. Use this to see what's on the plate or find a specific task.",
    {
      player: playerParam,
    },
    READ_ONLY,
    async ({ player: input }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const { data: promoted } =
          await db.getPromotedTasksForToday(player.id)

        if (!promoted || promoted.length === 0) {
          return textResult(
            `${player.first_name}'s today: No tasks planned. Use plan_tasks to add some.`
          )
        }

        type PromotedTask = {
          id: string
          status: string
          timer_started_at: string | null
          accumulated_seconds: number
          notes: string | null
          tasks: {
            title: string
            action_type: string
            description: string | null
            resource_url: string | null
          }
          enrollments: { curricula: { name: string } }
        }

        const lines: string[] = [
          `**${player.first_name}'s today:**`,
        ]
        for (let i = 0; i < promoted.length; i++) {
          const pt = promoted[i] as PromotedTask
          const task = pt.tasks
          const currName =
            pt.enrollments?.curricula?.name ?? 'Unknown'
          let line = `${i + 1}. ${task.title} [${task.action_type}] — ${currName}`
          if (task.resource_url)
            line += `\n   URL: ${task.resource_url}`
          if (task.description) line += `\n   ${task.description}`
          if (pt.timer_started_at) line += '\n   [TIMER RUNNING]'
          else if (pt.accumulated_seconds > 0)
            line += `\n   Time: ${Math.round(pt.accumulated_seconds / 60)}m`
          if (pt.notes) line += `\n   Notes: ${pt.notes}`
          lines.push(line)
        }

        return textResult(lines.join('\n'))
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to get today.'
        )
      }
    }
  )

  server.tool(
    'get_today_summary',
    "Get a quick progress snapshot for today: tasks completed vs remaining and total time spent. Use this for a status check, not full task details.",
    {
      player: playerParam,
    },
    READ_ONLY,
    async ({ player: input }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const { data: promoted } =
          await db.getPromotedTasksForToday(player.id)
        const timeZone = resolveTimeZone(player.time_zone)
        const todayStr = todayInTimeZone(timeZone)
        const { data: completed } = await db.getCompletedTasksToday(
          player.id,
          todayStr,
          timeZone
        )

        const promotedCount = promoted?.length ?? 0
        const completedCount = completed?.length ?? 0
        const remaining = promotedCount

        type TaskWithTime = {
          time_spent_minutes?: number
          accumulated_seconds?: number
          timer_started_at?: string
        }
        const totalMinutes = (
          (completed ?? []) as TaskWithTime[]
        ).reduce((sum, t) => sum + (t.time_spent_minutes ?? 0), 0)
        const activeMinutes = (
          (promoted ?? []) as TaskWithTime[]
        ).reduce((sum, t) => {
          let secs = t.accumulated_seconds ?? 0
          if (t.timer_started_at) {
            secs += Math.floor(
              (Date.now() -
                new Date(t.timer_started_at).getTime()) /
                1000
            )
          }
          return sum + secs / 60
        }, 0)

        return textResult(
          [
            `${player.first_name}'s today summary:`,
            `Completed: ${completedCount}`,
            `Remaining: ${remaining}`,
            `Time completed: ${Math.round(totalMinutes)} min`,
            `Time in progress: ${Math.round(activeMinutes)} min`,
          ].join('\n')
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to get summary.'
        )
      }
    }
  )

  server.tool(
    'complete_task',
    'Mark a task on today as complete. Stops the timer if running.',
    {
      player: playerParam,
      task: z.string().describe('Task title or player_task ID'),
      notes: z.string().optional().describe('Completion notes'),
      time_spent_minutes: z
        .number()
        .optional()
        .describe('Manual time override in minutes'),
    },
    WRITE,
    async ({ player: input, task: taskInput, notes, time_spent_minutes }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const pt = await resolvePromotedTask(player.id, taskInput)

        // Reject zero-minute completion: zero means the task did not actually
        // happen, which should return it to the Plan inventory via unfinish_task
        // rather than being saved as completed with 0 minutes spent.
        if (time_spent_minutes === 0) {
          return errorResult(
            'Cannot complete a task with 0 minutes. If the player did not actually do the task, use unfinish_task to return it to the Plan inventory. If they did some work, pass the real time_spent_minutes.'
          )
        }

        const confirmedSeconds =
          time_spent_minutes !== undefined
            ? time_spent_minutes * 60
            : undefined

        const { error } = await db.completeTask(
          pt.id,
          confirmedSeconds
        )
        if (error)
          return errorResult(
            'Failed to complete task: ' + error.message
          )

        if (notes) {
          await db.updatePlayerTask(pt.id, {
            notes: notes.trim(),
          })
        }

        return textResult(
          `Completed task for ${player.first_name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to complete task.'
        )
      }
    }
  )

  server.tool(
    'unfinish_task',
    "Return a TODAY task (status=promoted) to the Plan inventory as not finished. Use this when the player did not actually do a task that's currently on today and wants to try it later. ONLY operates on tasks already promoted to today; for an already-completed or skipped task in the log, use reset_task instead. Distinct from skip_task (permanently skipped) and complete_task (records time spent). Clears the timer and today fields.",
    {
      player: playerParam,
      task: z.string().describe('Task title or player_task ID'),
      notes: z.string().optional().describe('Why the task is being returned to the Plan'),
    },
    WRITE,
    async ({ player: input, task: taskInput, notes }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const pt = await resolvePromotedTask(player.id, taskInput)

        if (notes) {
          await db.updatePlayerTask(pt.id, { notes: notes.trim() })
        }

        const { error } = await db.unfinishTask(pt.id)
        if (error)
          return errorResult(
            'Failed to unfinish task: ' + error.message
          )

        return textResult(
          `Returned task to ${player.first_name}'s Plan inventory.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to unfinish task.'
        )
      }
    }
  )

  server.tool(
    'reset_task',
    "Reset a COMPLETED or SKIPPED task back to the Plan inventory. Use when the player wants to redo a task they've already finished (or undo a mistaken completion). Wipes completed_at and time_spent_minutes — those values are lost — and the task can be promoted again from /plan. ONLY operates on tasks in the log; for a task currently on today (status=promoted), use unfinish_task. If multiple historical entries match by title, the most recent is used; pass player_task_id to disambiguate.",
    {
      player: playerParam,
      task: z.string().describe('Task title or player_task ID from the log'),
      notes: z.string().optional().describe('Why the task is being reset'),
    },
    DESTRUCTIVE,
    async ({ player: input, task: taskInput, notes }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const pt = await resolveCompletedTask(player.id, taskInput)

        if (notes) {
          await db.updatePlayerTask(pt.id, { notes: notes.trim() })
        }

        const { error } = await db.unfinishTask(pt.id)
        if (error)
          return errorResult(
            'Failed to reset task: ' + error.message
          )

        return textResult(
          `Reset task to ${player.first_name}'s Plan inventory. Recorded time was cleared.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to reset task.'
        )
      }
    }
  )

  server.tool(
    'skip_task',
    'Skip a task on today without completing it. The task is marked as skipped in the log and will not come back.',
    {
      player: playerParam,
      task: z.string().describe('Task title or player_task ID'),
    },
    DESTRUCTIVE,
    async ({ player: input, task: taskInput }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const pt = await resolvePromotedTask(player.id, taskInput)

        const { data: playerTask } = await db.getPlayerTaskById(
          pt.id
        )
        if (!playerTask) return errorResult('Task not found.')
        const ptData = playerTask as {
          enrollment_id: string
          task_id: string
          loop_number: number
        }

        const { error } = await db.skipTask(
          ptData.enrollment_id,
          ptData.task_id,
          ptData.loop_number
        )
        if (error) return errorResult('Failed to skip task.')
        return textResult(
          `Skipped task for ${player.first_name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to skip task.'
        )
      }
    }
  )

  server.tool(
    'start_task',
    'Start the timer on a task on today.',
    {
      player: playerParam,
      task: z.string().describe('Task title or player_task ID'),
    },
    WRITE,
    async ({ player: input, task: taskInput }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const pt = await resolvePromotedTask(player.id, taskInput)

        const { error } = await db.startTask(pt.id, player.id)
        if (error)
          return errorResult(
            'Failed to start task: ' + error.message
          )
        return textResult(
          `Started timer for ${player.first_name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to start task.'
        )
      }
    }
  )

  server.tool(
    'pause_task',
    'Pause the timer on an in-progress task.',
    {
      player: playerParam,
      task: z.string().describe('Task title or player_task ID'),
    },
    WRITE,
    async ({ player: input, task: taskInput }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const pt = await resolvePromotedTask(player.id, taskInput)

        const { data, error } = await db.pauseTask(pt.id)
        if (error)
          return errorResult(
            'Failed to pause task: ' + error.message
          )
        const accumulated =
          (data as { accumulated_seconds: number } | null)
            ?.accumulated_seconds ?? 0
        return textResult(
          `Paused timer for ${player.first_name}. Accumulated: ${Math.round(accumulated / 60)} min.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to pause task.'
        )
      }
    }
  )

  server.tool(
    'resume_task',
    'Resume the timer on a paused task.',
    {
      player: playerParam,
      task: z.string().describe('Task title or player_task ID'),
    },
    WRITE,
    async ({ player: input, task: taskInput }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const pt = await resolvePromotedTask(player.id, taskInput)

        const { error } = await db.startTask(pt.id, player.id)
        if (error)
          return errorResult(
            'Failed to resume task: ' + error.message
          )
        return textResult(
          `Resumed timer for ${player.first_name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to resume task.'
        )
      }
    }
  )

  server.tool(
    'reorder_today',
    "Reorder tasks on a player's today page.",
    {
      player: playerParam,
      task_ids: z
        .array(z.string())
        .describe('Ordered list of player_task IDs'),
    },
    WRITE,
    async ({ player: input, task_ids }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const updates = task_ids.map((id, i) => ({
          id,
          display_order: i + 1,
        }))
        const { error } = await db.updateTodayTaskOrder(updates)
        if (error) return errorResult('Failed to reorder today.')
        return textResult(
          `Reordered ${task_ids.length} tasks for ${player.first_name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to reorder today.'
        )
      }
    }
  )

  server.tool(
    'clear_today',
    "End the day — moves any unfinished tasks back to their curriculum queues. Use this when the player is done for the day.",
    {
      player: playerParam,
    },
    DESTRUCTIVE,
    async ({ player: input }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const { data: promoted } =
          await db.getPromotedTasksForToday(player.id)

        if (!promoted || promoted.length === 0) {
          return textResult('No tasks on today to clear.')
        }

        type TaskWithTimer = {
          id: string
          timer_started_at: string | null
          status: string
        }
        const running = (promoted as TaskWithTimer[]).filter(
          (pt) => pt.timer_started_at
        )
        if (running.length > 0) {
          return errorResult(
            'Cannot clear today — timers are still running. Pause or complete them first.'
          )
        }

        const timeZone = resolveTimeZone(player.time_zone)
        const todayStr = todayInTimeZone(timeZone)
        const { data: completedToday } =
          await db.getCompletedTasksToday(player.id, todayStr, timeZone)

        const promotedIds = (promoted as { id: string }[]).map(
          (pt) => pt.id
        )
        const completedIds = (
          (completedToday ?? []) as { id: string }[]
        ).map((pt) => pt.id)

        const { error } = await db.clearTodayList(
          promotedIds,
          completedIds
        )
        if (error) return errorResult('Failed to clear today.')
        return textResult(
          `Cleared today for ${player.first_name}. ${promotedIds.length} tasks returned to Plan.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to clear today.'
        )
      }
    }
  )
}
