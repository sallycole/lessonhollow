import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_PLAYERS_PER_GUIDE } from '@/lib/constants'
import {
  playerParam,
  resolvePlayer,
  getPlayersForGuide,
  textResult,
  errorResult,
} from '../helpers'
import { READ_ONLY, WRITE, WRITE_IDEMPOTENT } from '../annotations'

export function registerPlayerTools(
  server: McpServer,
  guideId: string
) {
  server.tool(
    'list_players',
    'List all players (students/learners) on your account.',
    {},
    READ_ONLY,
    async () => {
      try {
        const players = await getPlayersForGuide(guideId)
        const lines: string[] = []
        for (const p of players) {
          const { count } = await db.getActiveEnrollmentCountByPlayer(
            p.id
          )
          lines.push(
            `- ${p.first_name} ${p.last_name} (@${p.username}) — ${p.time_zone}, ${count ?? 0} active enrollments`
          )
        }
        return textResult(lines.join('\n') || 'No players found.')
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : 'Failed to list players.'
        )
      }
    }
  )

  server.tool(
    'get_player',
    'Look up a player (student/learner) by name, username, or ID.',
    {
      player: playerParam,
    },
    READ_ONLY,
    async ({ player: input }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const { count } = await db.getActiveEnrollmentCountByPlayer(
          player.id
        )
        return textResult(
          [
            `Name: ${player.first_name} ${player.last_name}`,
            `Username: ${player.username}`,
            `Timezone: ${player.time_zone}`,
            `Active enrollments: ${count ?? 0}`,
            `ID: ${player.id}`,
          ].join('\n')
        )
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : 'Failed to get player.'
        )
      }
    }
  )

  server.tool(
    'create_player',
    'Create a new player (student/learner) account.',
    {
      first_name: z.string().describe('First name'),
      last_name: z.string().optional().describe('Last name'),
      username: z
        .string()
        .describe(
          'Username (letters, numbers, hyphens, underscores)'
        ),
      time_zone: z
        .string()
        .describe('IANA timezone (e.g. America/New_York)'),
      password: z
        .string()
        .describe('Password (minimum 8 characters)'),
    },
    WRITE,
    async ({ first_name, last_name, username, time_zone, password }) => {
      try {
        const firstName = first_name.trim()
        const lastName = (last_name || '').trim()
        const user = username.trim()
        const tz = time_zone.trim()

        if (!firstName) return errorResult('first_name is required.')
        if (!user) return errorResult('username is required.')
        if (!tz) return errorResult('time_zone is required.')
        if (!password || password.length < 8)
          return errorResult(
            'password must be at least 8 characters.'
          )

        if (!/^[a-zA-Z0-9_-]+$/.test(user)) {
          return errorResult(
            'Username can only contain letters, numbers, hyphens, and underscores.'
          )
        }

        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz })
        } catch {
          return errorResult(`Invalid timezone: ${tz}`)
        }

        const { count } = await db.getPlayerCountByGuide(guideId)
        if ((count ?? 0) >= MAX_PLAYERS_PER_GUIDE) {
          return errorResult(
            `Maximum ${MAX_PLAYERS_PER_GUIDE} players reached.`
          )
        }

        const { data: existing } = await db.getPlayerByUsernameCaseInsensitive(user)
        if (existing) return errorResult('Username is already taken.')

        const placeholderEmail = `${user}@player.lessonhollow.local`
        const admin = createAdminClient()

        const { data: authData, error: authError } =
          await admin.auth.admin.createUser({
            email: placeholderEmail,
            password,
            email_confirm: true,
            user_metadata: { role: 'player' },
          })

        if (authError || !authData.user) {
          return errorResult('Failed to create player account.')
        }

        const { error: dbError } = await db.createPlayer({
          guide_id: guideId,
          username: user,
          first_name: firstName,
          last_name: lastName,
          time_zone: tz,
          auth_user_id: authData.user.id,
        })

        if (dbError) {
          await admin.auth.admin.deleteUser(authData.user.id)
          return errorResult('Failed to save player.')
        }

        return textResult(
          `Created player ${firstName} (@${user}). Password: ${password} — save this, it cannot be retrieved later.`
        )
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to create player.'
        )
      }
    }
  )

  server.tool(
    'update_player',
    "Edit an existing player's (student's/learner's) details.",
    {
      player: playerParam,
      first_name: z.string().optional().describe('New first name'),
      last_name: z.string().optional().describe('New last name'),
      username: z.string().optional().describe('New username'),
      time_zone: z.string().optional().describe('New timezone'),
    },
    WRITE_IDEMPOTENT,
    async ({ player: input, first_name, last_name, username, time_zone }) => {
      try {
        const player = await resolvePlayer(guideId, input)
        const updates: Record<string, unknown> = {}

        if (first_name)
          updates.first_name = first_name.trim()
        if (last_name) updates.last_name = last_name.trim()
        if (time_zone) {
          try {
            Intl.DateTimeFormat(undefined, {
              timeZone: time_zone,
            })
          } catch {
            return errorResult(`Invalid timezone: ${time_zone}`)
          }
          updates.time_zone = time_zone
        }
        if (username) {
          const newUsername = username.trim()
          if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
            return errorResult(
              'Username can only contain letters, numbers, hyphens, and underscores.'
            )
          }
          const { data: existing } =
            await db.getPlayerByUsernameCaseInsensitive(newUsername)
          if (existing && existing.id !== player.id)
            return errorResult('Username is already taken.')
          updates.username = newUsername

          const admin = createAdminClient()
          await admin.auth.admin.updateUserById(
            player.auth_user_id,
            {
              email: `${newUsername}@player.lessonhollow.local`,
            }
          )
        }

        if (Object.keys(updates).length === 0)
          return errorResult('No fields to update.')

        const { error } = await db.updatePlayer(player.id, updates)
        if (error) return errorResult('Failed to update player.')

        return textResult(`Updated ${player.first_name}.`)
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : 'Failed to update player.'
        )
      }
    }
  )
}
