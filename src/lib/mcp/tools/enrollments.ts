import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  playerParam,
  resolvePlayer,
  resolveCurriculum,
  resolveEnrollment,
  textResult,
  errorResult,
} from '../helpers'
import { WRITE, WRITE_IDEMPOTENT, DESTRUCTIVE } from '../annotations'

export function registerEnrollmentTools(
  server: McpServer,
  guideId: string
) {
  server.tool(
    'enroll_player',
    'Enroll a player (student/learner) in a curriculum. Enrolls one player at a time — call once per player.',
    {
      player: playerParam,
      curriculum: z.string().describe('Curriculum name or ID'),
      enrollment_type: z
        .enum(['core', 'elective', 'memorization'])
        .describe('Enrollment type: "core" (must finish by target date, pacing enforced), "elective" (flexible pace, optional target date), or "memorization" (loops through tasks repeatedly).'),
      target_completion_date: z
        .string()
        .optional()
        .describe(
          'Target date (ISO 8601). Required for core and memorization.'
        ),
      start_date: z
        .string()
        .optional()
        .describe(
          'Start date (ISO 8601). Defaults to today. Set a future date if the player begins later — pacing counts no tasks as behind before this date.'
        ),
      study_days_per_week: z
        .number()
        .optional()
        .describe('Study days per week (0.5–7). Defaults to 5.'),
      target_loops: z
        .number()
        .optional()
        .describe(
          'Number of loops (memorization only, must be ≥ 1).'
        ),
    },
    WRITE,
    async ({
      player: input,
      curriculum: currInput,
      enrollment_type,
      target_completion_date,
      start_date,
      study_days_per_week,
      target_loops,
    }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const curriculum = await resolveCurriculum(
          guideId,
          currInput
        )

        // Check for existing enrollment
        const { data: existing } =
          await db.getEnrollmentByPlayerAndCurriculum(
            player.id,
            curriculum.id
          )
        if (existing)
          return errorResult(
            `${player.first_name} is already enrolled in "${curriculum.name}".`
          )

        const data: Record<string, unknown> = {
          player_id: player.id,
          curriculum_id: curriculum.id,
          enrollment_type,
          study_days_per_week: study_days_per_week ?? 5,
        }

        if (target_completion_date) {
          data.target_completion_date = target_completion_date
        } else if (
          enrollment_type === 'core' ||
          enrollment_type === 'memorization'
        ) {
          return errorResult(
            `target_completion_date is required for ${enrollment_type} enrollments.`
          )
        }

        if (enrollment_type === 'memorization') {
          if (target_loops) {
            data.target_loops = target_loops
          } else {
            return errorResult(
              'target_loops is required for memorization enrollments.'
            )
          }
        }

        if (start_date) {
          data.start_date = start_date
        }

        const { error } = await db.createEnrollment(
          data as Parameters<typeof db.createEnrollment>[0]
        )
        if (error)
          return errorResult(
            'Failed to create enrollment: ' + error.message
          )
        return textResult(
          `Enrolled ${player.first_name} in "${curriculum.name}" (${enrollment_type}).`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to enroll.'
        )
      }
    }
  )

  server.tool(
    'update_enrollment',
    'Edit enrollment settings.',
    {
      player: playerParam,
      curriculum: z.string().describe('Curriculum name or ID'),
      enrollment_type: z
        .enum(['core', 'elective', 'memorization'])
        .optional()
        .describe('New enrollment type'),
      target_completion_date: z
        .string()
        .optional()
        .describe('New target date (ISO 8601)'),
      start_date: z
        .string()
        .optional()
        .describe(
          'New start date (ISO 8601). Pacing counts no tasks as behind before this date.'
        ),
      study_days_per_week: z
        .number()
        .optional()
        .describe('New study days per week'),
      target_loops: z
        .number()
        .optional()
        .describe('New target loops (memorization only)'),
    },
    WRITE_IDEMPOTENT,
    async ({
      player: input,
      curriculum: currInput,
      enrollment_type,
      target_completion_date,
      start_date,
      study_days_per_week,
      target_loops,
    }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const enrollment = await resolveEnrollment(
          guideId,
          player.id,
          currInput
        )

        const updates: Record<string, unknown> = {}
        if (enrollment_type)
          updates.enrollment_type = enrollment_type
        if (target_completion_date)
          updates.target_completion_date = target_completion_date
        if (start_date) updates.start_date = start_date
        if (study_days_per_week)
          updates.study_days_per_week = study_days_per_week
        if (target_loops) updates.target_loops = target_loops

        if (Object.keys(updates).length === 0)
          return errorResult('No fields to update.')

        const { error } = await db.updateEnrollment(
          enrollment.id,
          updates as Parameters<typeof db.updateEnrollment>[1]
        )
        if (error)
          return errorResult('Failed to update enrollment.')
        return textResult(
          `Updated enrollment for ${player.first_name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to update enrollment.'
        )
      }
    }
  )

  server.tool(
    'pause_enrollment',
    'Pause an active enrollment.',
    {
      player: playerParam,
      curriculum: z.string().describe('Curriculum name or ID'),
    },
    WRITE,
    async ({ player: input, curriculum: currInput }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const enrollment = await resolveEnrollment(
          guideId,
          player.id,
          currInput
        )
        if (enrollment.status !== 'active')
          return errorResult('Enrollment is not active.')

        const { error } = await db.updateEnrollment(enrollment.id, {
          status: 'paused',
        })
        if (error)
          return errorResult('Failed to pause enrollment.')
        return textResult(
          `Paused enrollment for ${player.first_name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to pause enrollment.'
        )
      }
    }
  )

  server.tool(
    'resume_enrollment',
    'Resume a paused enrollment.',
    {
      player: playerParam,
      curriculum: z.string().describe('Curriculum name or ID'),
    },
    WRITE,
    async ({ player: input, curriculum: currInput }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const enrollment = await resolveEnrollment(
          guideId,
          player.id,
          currInput
        )
        if (enrollment.status !== 'paused')
          return errorResult('Enrollment is not paused.')

        const { error } = await db.updateEnrollment(enrollment.id, {
          status: 'active',
        })
        if (error)
          return errorResult('Failed to resume enrollment.')
        return textResult(
          `Resumed enrollment for ${player.first_name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to resume enrollment.'
        )
      }
    }
  )

  server.tool(
    'finish_enrollment',
    'Permanently mark an enrollment as finished. Skips any remaining tasks. This cannot be undone.',
    {
      player: playerParam,
      curriculum: z.string().describe('Curriculum name or ID'),
    },
    DESTRUCTIVE,
    async ({ player: input, curriculum: currInput }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const enrollment = await resolveEnrollment(
          guideId,
          player.id,
          currInput
        )

        const { error } = await db.updateEnrollment(enrollment.id, {
          status: 'finished',
        })
        if (error)
          return errorResult('Failed to finish enrollment.')
        return textResult(
          `Marked enrollment as finished for ${player.first_name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to finish enrollment.'
        )
      }
    }
  )

  server.tool(
    'unenroll_player',
    'Remove a player (student/learner) from a curriculum entirely.',
    {
      player: playerParam,
      curriculum: z.string().describe('Curriculum name or ID'),
    },
    DESTRUCTIVE,
    async ({ player: input, curriculum: currInput }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const enrollment = await resolveEnrollment(
          guideId,
          player.id,
          currInput
        )

        await db.deletePlayerTasksByEnrollment(enrollment.id)
        const { error } = await db.deleteEnrollment(enrollment.id)
        if (error) return errorResult('Failed to unenroll.')
        return textResult(
          `Unenrolled ${player.first_name}.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to unenroll.'
        )
      }
    }
  )
}
