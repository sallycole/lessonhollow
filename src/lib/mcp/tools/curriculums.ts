import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '@/lib/db'
import { GRADE_LEVELS, type GradeLevel } from '@/lib/constants'
import { parseCsv } from '@/lib/csv-parser'
import {
  playerParam,
  resolvePlayer,
  resolveCurriculum,
  resolveCurriculumTask,
  getPlayersForGuide,
  textResult,
  errorResult,
  type CurriculumRecord,
  type TaskRecord,
} from '../helpers'
import {
  READ_ONLY,
  WRITE,
  WRITE_IDEMPOTENT,
  DESTRUCTIVE,
} from '../annotations'

function csvEscape(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n')
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function registerCurriculumTools(
  server: McpServer,
  guideId: string
) {
  server.tool(
    'list_curriculums',
    'List all curriculums across all players, showing task counts and ownership.',
    {},
    READ_ONLY,
    async () => {
      try {
        const players = await getPlayersForGuide(guideId)
        const allCurricula: Array<
          CurriculumRecord & {
            playerName: string
            taskCount: number
          }
        > = []

        for (const player of players) {
          const { data: curricula } =
            await db.getCurriculaWithTaskCountByUser(
              player.auth_user_id
            )
          for (const c of (curricula ?? []) as Array<
            CurriculumRecord & { tasks: Array<{ id: string }> }
          >) {
            allCurricula.push({
              ...c,
              playerName: player.first_name,
              taskCount: Array.isArray(c.tasks)
                ? c.tasks.length
                : 0,
            })
          }
        }

        if (allCurricula.length === 0)
          return textResult('No curriculums found.')

        return textResult(
          allCurricula
            .map((c) => {
              const meta = [c.publisher, c.grade_level]
                .filter(Boolean)
                .join(', ')
              return `- ${c.name}${meta ? ` (${meta})` : ''} — ${c.taskCount} tasks [${c.playerName}]`
            })
            .join('\n')
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to list curriculums.'
        )
      }
    }
  )

  server.tool(
    'get_curriculum',
    'View a curriculum and its full task list.',
    {
      curriculum: z.string().describe('Curriculum name or ID'),
    },
    READ_ONLY,
    async ({ curriculum: input }) => {
      try {
        const curriculum = await resolveCurriculum(guideId, input)
        const { data: tasks } = await db.getTasksByCurriculum(
          curriculum.id
        )
        const taskList = (tasks ?? []) as Array<{
          id: string
          title: string
          description?: string
          action_type: string
          resource_url?: string
          position: number
        }>

        const lines: string[] = [
          `# ${curriculum.name}`,
          curriculum.description
            ? `Description: ${curriculum.description}`
            : '',
          curriculum.publisher
            ? `Publisher: ${curriculum.publisher}`
            : '',
          curriculum.grade_level
            ? `Grade: ${curriculum.grade_level}`
            : '',
          curriculum.resource_url
            ? `URL: ${curriculum.resource_url}`
            : '',
          '',
          `Tasks (${taskList.length}):`,
        ].filter(Boolean)

        for (let i = 0; i < taskList.length; i++) {
          const t = taskList[i]
          let line = `${i + 1}. ${t.title} [${t.action_type}] (id: ${t.id})`
          if (t.resource_url) line += `\n   URL: ${t.resource_url}`
          if (t.description) line += `\n   ${t.description}`
          lines.push(line)
        }

        return textResult(lines.join('\n'))
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to get curriculum.'
        )
      }
    }
  )

  server.tool(
    'create_curriculum',
    'Create a new curriculum under a player account.',
    {
      player: playerParam,
      name: z.string().describe('Curriculum name'),
      description: z.string().optional().describe('Description'),
      publisher: z.string().optional().describe('Publisher'),
      grade_level: z.string().optional().describe('Grade level'),
      resource_url: z.string().optional().describe('Resource URL'),
    },
    WRITE,
    async ({
      player: input,
      name,
      description,
      publisher,
      grade_level,
      resource_url,
    }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const trimmedName = name.trim()
        if (!trimmedName) return errorResult('name is required.')

        const gradeLevel = grade_level?.trim()
        if (
          gradeLevel &&
          !(GRADE_LEVELS as readonly string[]).includes(gradeLevel)
        ) {
          return errorResult(
            `Invalid grade level "${gradeLevel}". Valid options: ${GRADE_LEVELS.join(', ')}`
          )
        }

        const { data, error } = await db.createCurriculum({
          user_id: player.auth_user_id,
          name: trimmedName,
          description: description?.trim() || undefined,
          publisher: publisher?.trim() || undefined,
          grade_level: (gradeLevel || undefined) as
            | GradeLevel
            | undefined,
          resource_url: resource_url?.trim() || undefined,
        })

        if (error) return errorResult('Failed to create curriculum.')
        return textResult(
          `Created curriculum "${trimmedName}" for ${player.first_name}. ID: ${(data as { id: string }).id}`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to create curriculum.'
        )
      }
    }
  )

  server.tool(
    'update_curriculum',
    'Edit curriculum metadata.',
    {
      curriculum: z.string().describe('Curriculum name or ID'),
      name: z.string().optional().describe('New name'),
      description: z
        .string()
        .optional()
        .describe('New description'),
      publisher: z.string().optional().describe('New publisher'),
      grade_level: z
        .string()
        .optional()
        .describe('New grade level'),
      resource_url: z
        .string()
        .optional()
        .describe('New resource URL'),
    },
    WRITE_IDEMPOTENT,
    async ({
      curriculum: input,
      name,
      description,
      publisher,
      grade_level,
      resource_url,
    }) => {
      try {
        const curriculum = await resolveCurriculum(guideId, input)
        const updates: Record<string, unknown> = {}

        if (name) updates.name = name.trim()
        if (description !== undefined)
          updates.description = description?.trim() || null
        if (publisher !== undefined)
          updates.publisher = publisher?.trim() || null
        if (grade_level !== undefined) {
          const gl = grade_level?.trim() || null
          if (
            gl &&
            !(GRADE_LEVELS as readonly string[]).includes(gl)
          ) {
            return errorResult(
              `Invalid grade level "${gl}". Valid options: ${GRADE_LEVELS.join(', ')}`
            )
          }
          updates.grade_level = gl
        }
        if (resource_url !== undefined)
          updates.resource_url = resource_url?.trim() || null

        if (Object.keys(updates).length === 0)
          return errorResult('No fields to update.')

        const { error } = await db.updateCurriculum(
          curriculum.id,
          updates
        )
        if (error)
          return errorResult('Failed to update curriculum.')
        return textResult(`Updated "${curriculum.name}".`)
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to update curriculum.'
        )
      }
    }
  )

  server.tool(
    'add_task',
    "Add a new task to a curriculum's task list. This does not add it to today — use plan_tasks for that.",
    {
      curriculum: z.string().describe('Curriculum name or ID'),
      title: z.string().describe('Task title'),
      description: z
        .string()
        .optional()
        .describe('Task description'),
      action_type: z
        .enum(['Read', 'Watch', 'Listen', 'Do'])
        .optional()
        .describe('What the player does: Read, Watch, Listen, or Do. Defaults to Do.'),
      resource_url: z
        .string()
        .optional()
        .describe('Resource URL'),
      position: z
        .number()
        .optional()
        .describe('Position to insert at. Defaults to end.'),
    },
    WRITE,
    async ({
      curriculum: input,
      title,
      description,
      action_type,
      resource_url,
      position,
    }) => {
      try {
        const curriculum = await resolveCurriculum(guideId, input)
        const trimmedTitle = title.trim()
        if (!trimmedTitle) return errorResult('title is required.')

        const actionType = action_type ?? 'Do'

        let pos: number
        if (position !== undefined) {
          pos = position
          await db.shiftTaskPositionsAfter(curriculum.id, pos - 1)
        } else {
          // getMaxTaskPosition returns the bare max position (0 if empty).
          // Space appends by 10 so future inserts have room, matching the
          // web curriculum editor.
          const maxPos = await db.getMaxTaskPosition(curriculum.id)
          pos = maxPos + 10
        }

        const { data: created, error } = await db.createTask({
          curriculum_id: curriculum.id,
          title: trimmedTitle,
          description: description?.trim() || undefined,
          action_type: actionType,
          resource_url: resource_url?.trim() || undefined,
          position: pos,
        })

        if (error || !created) return errorResult('Failed to add task.')
        return textResult(
          `Added task "${trimmedTitle}" to ${curriculum.name} at position ${pos}. ID: ${(created as { id: string }).id}`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to add task.'
        )
      }
    }
  )

  server.tool(
    'update_task',
    'Edit an existing task in a curriculum.',
    {
      task_id: z
        .string()
        .describe(
          'Task ID, or the task title / 1-based number if `curriculum` is given'
        ),
      curriculum: z
        .string()
        .optional()
        .describe(
          'Curriculum name or ID. Lets you target the task by title or number instead of its ID.'
        ),
      title: z.string().optional().describe('New title'),
      description: z
        .string()
        .optional()
        .describe('New description'),
      action_type: z
        .enum(['Read', 'Watch', 'Listen', 'Do'])
        .optional()
        .describe('New action type: Read, Watch, Listen, or Do.'),
      resource_url: z
        .string()
        .optional()
        .describe('New resource URL'),
    },
    WRITE_IDEMPOTENT,
    async ({
      task_id,
      curriculum,
      title,
      description,
      action_type,
      resource_url,
    }) => {
      try {
        // Resolves by UUID, or by title/ordinal when a curriculum is given.
        // Ownership is verified inside the resolver.
        const task = await resolveCurriculumTask(
          guideId,
          task_id,
          curriculum
        )

        const updates: Record<string, unknown> = {}
        if (title) updates.title = title.trim()
        if (description !== undefined)
          updates.description = description?.trim() || null
        if (action_type) updates.action_type = action_type
        if (resource_url !== undefined)
          updates.resource_url = resource_url?.trim() || null

        if (Object.keys(updates).length === 0)
          return errorResult('No fields to update.')

        const { error } = await db.updateTask(task.id, updates)
        if (error) return errorResult('Failed to update task.')
        return textResult(`Updated task "${task.title}".`)
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to update task.'
        )
      }
    }
  )

  server.tool(
    'delete_task',
    "Delete a task from a curriculum's task list. Also removes the task from every enrolled player's progress and history. Cannot be undone.",
    {
      task_id: z
        .string()
        .describe(
          'Task ID, or the task title / 1-based number if `curriculum` is given'
        ),
      curriculum: z
        .string()
        .optional()
        .describe(
          'Curriculum name or ID. Lets you target the task by title or number instead of its ID.'
        ),
    },
    DESTRUCTIVE,
    async ({ task_id, curriculum }) => {
      try {
        const task = await resolveCurriculumTask(
          guideId,
          task_id,
          curriculum
        )
        const { error } = await db.deleteTask(task.id)
        if (error) return errorResult('Failed to delete task.')
        return textResult(`Deleted task "${task.title}".`)
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to delete task.'
        )
      }
    }
  )

  server.tool(
    'reorder_tasks',
    'Reorder tasks within a curriculum.',
    {
      curriculum: z.string().describe('Curriculum name or ID'),
      task_ids: z
        .array(z.string())
        .describe('Ordered list of task IDs'),
    },
    WRITE_IDEMPOTENT,
    async ({ curriculum: input, task_ids }) => {
      try {
        const curriculum = await resolveCurriculum(guideId, input)
        const updates = task_ids.map((id, i) => ({
          id,
          position: i + 1,
        }))
        const { error } = await db.updateTaskPositions(updates)
        if (error) return errorResult('Failed to reorder tasks.')
        return textResult(
          `Reordered ${task_ids.length} tasks in ${curriculum.name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to reorder tasks.'
        )
      }
    }
  )

  server.tool(
    'import_tasks_csv',
    'Import tasks into a curriculum from CSV data. CSV columns: title, description, action_type, resource_url.',
    {
      curriculum: z.string().describe('Curriculum name or ID'),
      csv_data: z
        .string()
        .describe(
          'CSV string with columns: title, description, action_type, resource_url'
        ),
      mode: z
        .enum(['append', 'replace'])
        .optional()
        .describe(
          "'append' (default) adds the CSV rows after the existing tasks. 'replace' makes the curriculum's task list match the CSV exactly: rows are matched to existing tasks by title (preserving those tasks and any enrolled player's progress on them), new rows are added, and existing tasks absent from the CSV are deleted."
        ),
    },
    WRITE,
    async ({ curriculum: input, csv_data, mode }) => {
      try {
        const curriculum = await resolveCurriculum(guideId, input)

        const hasHeader = csv_data.toLowerCase().includes('title')
        const content = hasHeader
          ? csv_data
          : `Title,Description,Action,URL\n${csv_data}`

        const result = parseCsv(content)
        if (result.tasks.length === 0) {
          return errorResult(
            'No tasks found in CSV data.' +
              (result.errors.length
                ? ` Errors: ${result.errors.map((e) => e.message).join('; ')}`
                : '')
          )
        }

        const warnings = result.errors.length
          ? ` Warnings: ${result.errors.map((e) => `Row ${e.row}: ${e.message}`).join('; ')}`
          : ''

        if (mode === 'replace') {
          const { data: existing } = await db.getTasksByCurriculum(
            curriculum.id
          )
          const existingTasks = (existing ?? []) as TaskRecord[]

          // Index existing tasks by normalized title so kept tasks keep their
          // id (and therefore any enrolled player's progress, which references
          // task_id). Duplicate titles are consumed one match at a time.
          const byTitle = new Map<string, TaskRecord[]>()
          for (const t of existingTasks) {
            const key = t.title.trim().toLowerCase()
            const bucket = byTitle.get(key) ?? []
            bucket.push(t)
            byTitle.set(key, bucket)
          }

          const usedIds = new Set<string>()
          let pos = 10
          let kept = 0
          let added = 0

          for (const row of result.tasks) {
            const key = row.title.trim().toLowerCase()
            const match = (byTitle.get(key) ?? []).find(
              (c) => !usedIds.has(c.id)
            )
            if (match) {
              usedIds.add(match.id)
              kept++
              const updates: Record<string, unknown> = {
                action_type: row.action_type,
                position: pos,
                description: row.description?.trim() || null,
                resource_url: row.resource_url?.trim() || null,
              }
              const { error } = await db.updateTask(match.id, updates)
              if (error)
                return errorResult('Failed to update an existing task.')
            } else {
              added++
              const { error } = await db.createTask({
                curriculum_id: curriculum.id,
                title: row.title,
                description: row.description,
                action_type: row.action_type,
                resource_url: row.resource_url,
                position: pos,
              })
              if (error) return errorResult('Failed to add a task.')
            }
            pos += 10
          }

          const toDelete = existingTasks.filter(
            (t) => !usedIds.has(t.id)
          )
          for (const t of toDelete) {
            const { error } = await db.deleteTask(t.id)
            if (error)
              return errorResult('Failed to remove an old task.')
          }

          return textResult(
            `Replaced tasks in ${curriculum.name}: ${result.tasks.length} tasks now present (${kept} kept with progress, ${added} added, ${toDelete.length} removed).${warnings}`
          )
        }

        // append (default): fix the max-position read and space by 10.
        const maxPos = await db.getMaxTaskPosition(curriculum.id)

        const taskData = result.tasks.map((t, i) => ({
          curriculum_id: curriculum.id,
          title: t.title,
          description: t.description,
          action_type: t.action_type,
          resource_url: t.resource_url,
          position: maxPos + (i + 1) * 10,
        }))

        const { error } = await db.createTasks(taskData)
        if (error) return errorResult('Failed to import tasks.')

        return textResult(
          `Imported ${result.tasks.length} tasks into ${curriculum.name}.${warnings}`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to import tasks.'
        )
      }
    }
  )

  server.tool(
    'export_curriculum_csv',
    'Export a curriculum and its tasks as CSV.',
    {
      curriculum: z.string().describe('Curriculum name or ID'),
    },
    READ_ONLY,
    async ({ curriculum: input }) => {
      try {
        const curriculum = await resolveCurriculum(guideId, input)
        const { data: tasks } = await db.getTasksByCurriculum(
          curriculum.id
        )
        const taskList = (tasks ?? []) as Array<{
          title: string
          description?: string
          action_type: string
          resource_url?: string
        }>

        const lines: string[] = [
          `Name,${csvEscape(curriculum.name)}`,
        ]
        if (curriculum.description)
          lines.push(
            `Description,${csvEscape(curriculum.description)}`
          )
        if (curriculum.publisher)
          lines.push(
            `Publisher,${csvEscape(curriculum.publisher)}`
          )
        if (curriculum.grade_level)
          lines.push(
            `Grade Level,${csvEscape(curriculum.grade_level)}`
          )
        if (curriculum.resource_url)
          lines.push(
            `Resource URL,${csvEscape(curriculum.resource_url)}`
          )

        lines.push('')
        lines.push('Title,Description,Action,URL')
        for (const t of taskList) {
          lines.push(
            [
              csvEscape(t.title),
              csvEscape(t.description ?? ''),
              csvEscape(t.action_type),
              csvEscape(t.resource_url ?? ''),
            ].join(',')
          )
        }

        return textResult(lines.join('\n'))
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to export curriculum.'
        )
      }
    }
  )
}
