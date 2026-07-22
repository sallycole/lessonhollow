import { z } from 'zod'
import { db } from '@/lib/db'

// ── Shared types ──

export type PlayerRecord = {
  id: string
  first_name: string
  last_name: string
  username: string
  time_zone: string
  auth_user_id: string
  guide_id: string
}

export type CurriculumRecord = {
  id: string
  name: string
  description?: string
  publisher?: string
  grade_level?: string
  resource_url?: string
  user_id: string
}

export type ResolvedItem = {
  id: string
  type: 'task' | 'spontaneous'
  playerId: string
}

// ── Shared Zod params ──

export const playerParam = z
  .string()
  .optional()
  .describe('Player first name, username, or ID. Optional if only one player.')

// ── Result helpers ──

type TextContent = { type: 'text'; text: string }
type ToolResult = { content: TextContent[]; isError?: boolean }

export function textResult(text: string): ToolResult {
  return { content: [{ type: 'text' as const, text }] }
}

export function errorResult(text: string): ToolResult {
  return {
    content: [{ type: 'text' as const, text: `Error: ${text}` }],
    isError: true,
  }
}

// ── Resolution helpers ──

export async function getPlayersForGuide(
  guideId: string
): Promise<PlayerRecord[]> {
  const { data: players, error } = await db.getPlayersByGuide(guideId)
  if (error || !players?.length) {
    throw new Error('No players found on your account.')
  }
  return players as PlayerRecord[]
}

export async function resolvePlayer(
  guideId: string,
  playerIdentifier?: string
): Promise<PlayerRecord> {
  const players = await getPlayersForGuide(guideId)

  if (!playerIdentifier) {
    if (players.length === 1) return players[0]
    throw new Error(
      `Multiple players found. Please specify which player: ${players.map((p) => p.first_name).join(', ')}`
    )
  }

  const byId = players.find((p) => p.id === playerIdentifier)
  if (byId) return byId

  const lower = playerIdentifier.toLowerCase()
  const byUsername = players.find(
    (p) => p.username.toLowerCase() === lower
  )
  if (byUsername) return byUsername

  const byName = players.find(
    (p) => p.first_name.toLowerCase() === lower
  )
  if (byName) return byName

  throw new Error(
    `Player "${playerIdentifier}" not found. Available: ${players.map((p) => `${p.first_name} (${p.username})`).join(', ')}`
  )
}

export async function resolveCurriculum(
  guideId: string,
  identifier: string
): Promise<CurriculumRecord> {
  // Try direct ID lookup first
  const { data: byId } = await db.getCurriculumById(identifier)
  if (byId) {
    const players = await getPlayersForGuide(guideId)
    if (
      players.some(
        (p) => p.auth_user_id === (byId as CurriculumRecord).user_id
      )
    ) {
      return byId as CurriculumRecord
    }
  }

  // Search by name across all players' curricula
  const players = await getPlayersForGuide(guideId)
  for (const player of players) {
    const { data: curricula } = await db.getCurriculaByUser(
      player.auth_user_id
    )
    if (curricula) {
      const match = (curricula as CurriculumRecord[]).find(
        (c) => c.name.toLowerCase() === identifier.toLowerCase()
      )
      if (match) return match
    }
  }

  throw new Error(`Curriculum "${identifier}" not found.`)
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TaskRecord = {
  id: string
  curriculum_id: string
  title: string
  description?: string
  action_type: string
  resource_url?: string
  position: number
}

// Resolves a curriculum TEMPLATE task (the `tasks` table) by UUID, or — when a
// curriculum context is supplied — by exact title, 1-based ordinal (the number
// shown in get_curriculum), or partial title. Verifies the task's curriculum is
// owned by this guide. Distinct from the player_task resolvers above, which
// target per-enrollment progress rows.
export async function resolveCurriculumTask(
  guideId: string,
  identifier: string,
  curriculumInput?: string
): Promise<TaskRecord> {
  if (UUID_RE.test(identifier)) {
    const { data: task } = await db.getTaskById(identifier)
    if (task) {
      // Throws if the task's curriculum is not owned by this guide.
      await resolveCurriculum(
        guideId,
        (task as TaskRecord).curriculum_id
      )
      return task as TaskRecord
    }
  }

  if (!curriculumInput) {
    throw new Error(
      `Task "${identifier}" not found. Pass a task ID, or provide the curriculum so the task can be matched by title or number.`
    )
  }

  const curriculum = await resolveCurriculum(guideId, curriculumInput)
  const { data: tasks } = await db.getTasksByCurriculum(curriculum.id)
  const taskList = (tasks ?? []) as TaskRecord[]

  const asOrdinal = Number(identifier)
  if (
    Number.isInteger(asOrdinal) &&
    asOrdinal >= 1 &&
    asOrdinal <= taskList.length
  ) {
    return taskList[asOrdinal - 1]
  }

  const lower = identifier.toLowerCase()
  const byTitle = taskList.find((t) => t.title.toLowerCase() === lower)
  if (byTitle) return byTitle

  const partial = taskList.find((t) =>
    t.title.toLowerCase().includes(lower)
  )
  if (partial) return partial

  throw new Error(
    `Task "${identifier}" not found in "${curriculum.name}".`
  )
}

export async function resolveEnrollment(
  guideId: string,
  playerId: string,
  curriculumIdentifier: string
): Promise<{
  id: string
  enrollment_type: string
  status: string
  curriculum_id: string
}> {
  const curriculum = await resolveCurriculum(guideId, curriculumIdentifier)
  const { data: enrollment } =
    await db.getEnrollmentByPlayerAndCurriculum(playerId, curriculum.id)
  if (!enrollment) {
    throw new Error(
      `Player is not enrolled in "${curriculum.name}".`
    )
  }
  return enrollment as {
    id: string
    enrollment_type: string
    status: string
    curriculum_id: string
  }
}

export async function resolvePromotedTask(
  playerId: string,
  taskIdentifier: string
): Promise<{
  id: string
  enrollment_id: string
  task_id: string
}> {
  const { data: promoted } = await db.getPromotedTasksForToday(playerId)
  if (!promoted || promoted.length === 0) {
    throw new Error('No tasks found on today. Use plan_tasks to add some.')
  }

  const byId = promoted.find(
    (pt: { id: string }) => pt.id === taskIdentifier
  )
  if (byId)
    return byId as { id: string; enrollment_id: string; task_id: string }

  const lower = taskIdentifier.toLowerCase()
  const byTitle = promoted.find(
    (pt: { tasks: { title: string } }) =>
      pt.tasks?.title?.toLowerCase() === lower
  )
  if (byTitle)
    return byTitle as {
      id: string
      enrollment_id: string
      task_id: string
    }

  const partial = promoted.find(
    (pt: { tasks: { title: string } }) =>
      pt.tasks?.title?.toLowerCase().includes(lower)
  )
  if (partial)
    return partial as {
      id: string
      enrollment_id: string
      task_id: string
    }

  throw new Error(
    `Task "${taskIdentifier}" not found in today's list. Available: ${promoted.map((pt: { tasks: { title: string } }) => pt.tasks?.title).join(', ')}`
  )
}

// Resolves a completed or skipped player_task for this player by ID, exact
// title, or partial title. Used by reset_task. Distinct from resolvePromotedTask
// (today's active list) so a model cannot accidentally unfinish an entire
// curriculum's history through the today-only path.
export async function resolveCompletedTask(
  playerId: string,
  taskIdentifier: string
): Promise<{
  id: string
  enrollment_id: string
  task_id: string
}> {
  const { data } = await db.getAllFeedItems(playerId)
  const tasks = (data?.tasks ?? []) as Array<{
    id: string
    enrollment_id: string
    task_id: string
    tasks: { title: string }
  }>
  if (tasks.length === 0) {
    throw new Error(
      'No completed or skipped tasks found in the log. Use complete_task on a today task first.'
    )
  }

  const byId = tasks.find((pt) => pt.id === taskIdentifier)
  if (byId) return byId

  const lower = taskIdentifier.toLowerCase()
  const byTitle = tasks.find(
    (pt) => pt.tasks?.title?.toLowerCase() === lower
  )
  if (byTitle) return byTitle

  const partial = tasks.find(
    (pt) => pt.tasks?.title?.toLowerCase().includes(lower)
  )
  if (partial) return partial

  throw new Error(
    `Task "${taskIdentifier}" not found in the log. If the task is currently on today, use unfinish_task instead.`
  )
}

export async function resolveTaskItem(
  playerId: string,
  taskIdentifier: string
): Promise<ResolvedItem> {
  const { data: spontEntry } =
    await db.getSpontaneousEntryById(taskIdentifier)
  if (spontEntry && spontEntry.player_id === playerId) {
    return { id: spontEntry.id, type: 'spontaneous', playerId }
  }

  const { data: playerTask } =
    await db.getPlayerTaskById(taskIdentifier)
  if (playerTask) {
    const { data: enrollment } = await db.getEnrollmentById(
      playerTask.enrollment_id
    )
    if (enrollment?.player_id === playerId) {
      return { id: playerTask.id, type: 'task', playerId }
    }
  }

  const { data: spontByTitle } =
    await db.findSpontaneousEntryByTitle(playerId, taskIdentifier)
  if (spontByTitle)
    return { id: spontByTitle.id, type: 'spontaneous', playerId }

  const { data: taskByTitle } = await db.findCompletedTaskByTitle(
    playerId,
    taskIdentifier
  )
  if (taskByTitle) return { id: taskByTitle.id, type: 'task', playerId }

  throw new Error(
    `Task "${taskIdentifier}" not found for this player.`
  )
}

