import type { SupabaseClient } from '@supabase/supabase-js'
import { addDaysToDateKey, dateKeyInTimeZone } from '@/lib/date-tz'

export function createPlayerTasksDb(getClient: () => SupabaseClient) {
  const self = {
    async getPlayerTasksByEnrollment(enrollmentId: string) {
      return getClient()
        .from('player_tasks')
        .select('*, tasks(*)')
        .eq('enrollment_id', enrollmentId)
        .order('display_order')
    },

    async getPlayerTaskById(id: string) {
      return getClient()
        .from('player_tasks')
        .select('*, tasks(*)')
        .eq('id', id)
        .single()
    },

    async createPlayerTask(data: {
      enrollment_id: string
      task_id: string
      status?: 'pending' | 'completed' | 'skipped' | 'promoted'
      display_order?: number
      loop_number?: number
    }) {
      return getClient()
        .from('player_tasks')
        .insert(data)
        .select()
        .single()
    },

    async createPlayerTasks(data: Array<{
      enrollment_id: string
      task_id: string
      status?: 'pending' | 'completed' | 'skipped' | 'promoted'
      display_order?: number
      loop_number?: number
    }>) {
      return getClient()
        .from('player_tasks')
        .insert(data)
        .select()
    },

    async updatePlayerTask(
      id: string,
      data: Partial<{
        status: 'pending' | 'completed' | 'skipped' | 'promoted'
        time_spent_minutes: number
        started_at: string
        completed_at: string
        promoted_at: string | null
        display_order: number | null
        timer_started_at: string | null
        accumulated_seconds: number
        pause_log: Array<{ paused_at: string; unpaused_at: string | null }>
        photo_url: string | null
        notes: string | null
      }>
    ) {
      return getClient()
        .from('player_tasks')
        .update(data)
        .eq('id', id)
        .select()
        .single()
    },

    async updateTodayTaskOrder(updates: Array<{ id: string; display_order: number }>) {
      const client = getClient()
      const results = await Promise.all(
        updates.map(({ id, display_order }) =>
          client
            .from('player_tasks')
            .update({ display_order })
            .eq('id', id)
        )
      )
      const firstError = results.find((r) => r.error)
      return { error: firstError?.error ?? null }
    },

    async getRemainingTaskCountForEnrollment(enrollmentId: string) {
      const client = getClient()

      // Get enrollment to find curriculum
      const { data: enrollment, error: enrollError } = await client
        .from('enrollments')
        .select('curriculum_id')
        .eq('id', enrollmentId)
        .single()

      if (enrollError || !enrollment) {
        return { count: 0, error: enrollError }
      }

      // Get total tasks for curriculum
      const { count: totalTasks, error: totalError } = await client
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('curriculum_id', enrollment.curriculum_id)

      if (totalError) {
        return { count: 0, error: totalError }
      }

      // Get completed/skipped player_tasks for this enrollment
      const { count: doneCount, error: doneError } = await client
        .from('player_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('enrollment_id', enrollmentId)
        .in('status', ['completed', 'skipped'])

      if (doneError) {
        return { count: 0, error: doneError }
      }

      return { count: (totalTasks ?? 0) - (doneCount ?? 0), error: null }
    },

    async skipRemainingTasksForEnrollment(enrollmentId: string) {
      const client = getClient()

      // Get enrollment to find curriculum
      const { data: enrollment, error: enrollError } = await client
        .from('enrollments')
        .select('curriculum_id')
        .eq('id', enrollmentId)
        .single()

      if (enrollError || !enrollment) {
        return { error: enrollError }
      }

      // Get all task IDs for the curriculum
      const { data: tasks, error: tasksError } = await client
        .from('tasks')
        .select('id')
        .eq('curriculum_id', enrollment.curriculum_id)

      if (tasksError || !tasks) {
        return { error: tasksError }
      }

      const allTaskIds = new Set(tasks.map((t) => t.id))

      // Get existing player_tasks for this enrollment
      const { data: playerTasks, error: ptError } = await client
        .from('player_tasks')
        .select('id, task_id, status')
        .eq('enrollment_id', enrollmentId)

      if (ptError) {
        return { error: ptError }
      }

      // Update existing pending/promoted player_tasks to skipped
      const toUpdate = (playerTasks ?? []).filter(
        (pt) => pt.status === 'pending' || pt.status === 'promoted'
      )
      for (const pt of toUpdate) {
        await client
          .from('player_tasks')
          .update({ status: 'skipped' })
          .eq('id', pt.id)
      }

      // Create skipped player_tasks for tasks without any entry
      const existingTaskIds = new Set((playerTasks ?? []).map((pt) => pt.task_id))
      const missingTaskIds = [...allTaskIds].filter((id) => !existingTaskIds.has(id))

      if (missingTaskIds.length > 0) {
        const newEntries = missingTaskIds.map((taskId) => ({
          enrollment_id: enrollmentId,
          task_id: taskId,
          status: 'skipped' as const,
        }))
        const { error: insertError } = await client
          .from('player_tasks')
          .insert(newEntries)
        if (insertError) {
          return { error: insertError }
        }
      }

      return { error: null }
    },

    async skipTask(enrollmentId: string, taskId: string, loopNumber: number = 1) {
      const client = getClient()

      // Check if a player_task record already exists
      const { data: existing } = await client
        .from('player_tasks')
        .select('id, status')
        .eq('enrollment_id', enrollmentId)
        .eq('task_id', taskId)
        .eq('loop_number', loopNumber)
        .maybeSingle()

      if (existing) {
        // Already skipped — no-op
        if (existing.status === 'skipped') {
          return { data: existing, error: null }
        }
        // Update existing record
        return client
          .from('player_tasks')
          .update({ status: 'skipped' })
          .eq('id', existing.id)
          .select()
          .single()
      }

      // Create new player_task with skipped status
      return client
        .from('player_tasks')
        .insert({
          enrollment_id: enrollmentId,
          task_id: taskId,
          status: 'skipped',
          loop_number: loopNumber,
        })
        .select()
        .single()
    },

    async getNextPromotableTask(enrollmentId: string) {
      const client = getClient()

      // Get enrollment to find curriculum and type
      const { data: enrollment, error: enrollError } = await client
        .from('enrollments')
        .select('curriculum_id, enrollment_type')
        .eq('id', enrollmentId)
        .single()

      if (enrollError || !enrollment) {
        return { data: null, error: enrollError }
      }

      // Get all tasks for the curriculum ordered by position
      const { data: tasks, error: tasksError } = await client
        .from('tasks')
        .select('id, title, position')
        .eq('curriculum_id', enrollment.curriculum_id)
        .order('position')

      if (tasksError || !tasks || tasks.length === 0) {
        return { data: null, error: tasksError }
      }

      // Get player_tasks for this enrollment
      const { data: playerTasks, error: ptError } = await client
        .from('player_tasks')
        .select('id, task_id, status, loop_number')
        .eq('enrollment_id', enrollmentId)

      if (ptError) {
        return { data: null, error: ptError }
      }

      // For memorization, only consider the current (max) loop
      const currentLoop =
        enrollment.enrollment_type === 'memorization' && playerTasks && playerTasks.length > 0
          ? Math.max(...playerTasks.map((pt) => pt.loop_number))
          : 1

      // Build task_id -> {status, player_task_id} map (filtered to current loop for memorization)
      const statusMap = new Map<string, { status: string; playerTaskId: string }>()
      for (const pt of playerTasks ?? []) {
        if (enrollment.enrollment_type === 'memorization') {
          if (pt.loop_number === currentLoop) {
            statusMap.set(pt.task_id, { status: pt.status, playerTaskId: pt.id })
          }
        } else {
          statusMap.set(pt.task_id, { status: pt.status, playerTaskId: pt.id })
        }
      }

      // Find the first task that is pending (no record or status === 'pending')
      for (const task of tasks) {
        const entry = statusMap.get(task.id)
        if (!entry || entry.status === 'pending') {
          return {
            data: {
              taskId: task.id,
              taskTitle: task.title,
              playerTaskId: entry?.playerTaskId ?? null,
              enrollmentId,
              loopNumber: currentLoop,
            },
            error: null,
          }
        }
      }

      // All tasks in current loop are completed/skipped/promoted
      // For memorization: advance to next loop if no promoted tasks remain and at least one non-skipped task exists
      if (enrollment.enrollment_type === 'memorization') {
        const hasPromotedInLoop = Array.from(statusMap.values()).some(e => e.status === 'promoted')
        if (!hasPromotedInLoop) {
          // Permanently skipped = skipped in ANY loop
          const skippedTaskIds = new Set(
            (playerTasks ?? []).filter(pt => pt.status === 'skipped').map(pt => pt.task_id)
          )
          const newLoop = currentLoop + 1
          for (const task of tasks) {
            if (!skippedTaskIds.has(task.id)) {
              return {
                data: {
                  taskId: task.id,
                  taskTitle: task.title,
                  playerTaskId: null,
                  enrollmentId,
                  loopNumber: newLoop,
                },
                error: null,
              }
            }
          }
        }
      }

      return { data: null, error: null }
    },

    async getUpcomingTasks(enrollmentId: string, limit: number = 5) {
      const client = getClient()

      // Get enrollment to find curriculum and type
      const { data: enrollment, error: enrollError } = await client
        .from('enrollments')
        .select('curriculum_id, enrollment_type')
        .eq('id', enrollmentId)
        .single()

      if (enrollError || !enrollment) {
        return { data: null, error: enrollError }
      }

      // Get all tasks for the curriculum ordered by position
      const { data: tasks, error: tasksError } = await client
        .from('tasks')
        .select('id, title, description, resource_url, position, action_type')
        .eq('curriculum_id', enrollment.curriculum_id)
        .order('position')

      if (tasksError || !tasks || tasks.length === 0) {
        return { data: [], error: tasksError }
      }

      // Get player_tasks for this enrollment
      const { data: playerTasks, error: ptError } = await client
        .from('player_tasks')
        .select('id, task_id, status, loop_number')
        .eq('enrollment_id', enrollmentId)

      if (ptError) {
        return { data: [], error: ptError }
      }

      // For memorization, only consider the current (max) loop
      const currentLoop =
        enrollment.enrollment_type === 'memorization' && playerTasks && playerTasks.length > 0
          ? Math.max(...playerTasks.map((pt) => pt.loop_number))
          : 1

      // Build task_id -> status map (filtered to current loop for memorization)
      const statusMap = new Map<string, string>()
      for (const pt of playerTasks ?? []) {
        if (enrollment.enrollment_type === 'memorization') {
          if (pt.loop_number === currentLoop) {
            statusMap.set(pt.task_id, pt.status)
          }
        } else {
          statusMap.set(pt.task_id, pt.status)
        }
      }

      // Collect upcoming tasks: pending or promoted (not completed/skipped)
      const upcoming: {
        taskId: string
        taskTitle: string
        taskDescription: string | null
        resourceUrl: string | null
        actionType: 'Read' | 'Watch' | 'Listen' | 'Do'
        status: 'pending' | 'promoted'
        loopNumber: number
      }[] = []

      for (const task of tasks) {
        if (upcoming.length >= limit) break
        const status = statusMap.get(task.id)
        if (!status || status === 'pending') {
          upcoming.push({
            taskId: task.id,
            taskTitle: task.title,
            taskDescription: task.description ?? null,
            resourceUrl: task.resource_url ?? null,
            actionType: task.action_type ?? 'Do',
            status: 'pending',
            loopNumber: currentLoop,
          })
        } else if (status === 'promoted') {
          upcoming.push({
            taskId: task.id,
            taskTitle: task.title,
            taskDescription: task.description ?? null,
            resourceUrl: task.resource_url ?? null,
            actionType: task.action_type ?? 'Do',
            status: 'promoted',
            loopNumber: currentLoop,
          })
        }
        // completed/skipped tasks are skipped over
      }

      // For memorization: if no upcoming tasks in current loop and no promoted tasks, show next loop tasks
      if (upcoming.length === 0 && enrollment.enrollment_type === 'memorization') {
        const hasPromotedInLoop = Array.from(statusMap.values()).some(s => s === 'promoted')
        if (!hasPromotedInLoop) {
          const skippedTaskIds = new Set(
            (playerTasks ?? []).filter(pt => pt.status === 'skipped').map(pt => pt.task_id)
          )
          const newLoop = currentLoop + 1
          for (const task of tasks) {
            if (upcoming.length >= limit) break
            if (!skippedTaskIds.has(task.id)) {
              upcoming.push({
                taskId: task.id,
                taskTitle: task.title,
                taskDescription: task.description ?? null,
                resourceUrl: task.resource_url ?? null,
                actionType: task.action_type ?? 'Do',
                status: 'pending',
                loopNumber: newLoop,
              })
            }
          }
        }
      }

      return { data: upcoming, error: null }
    },

    async getPendingTasksForEnrollment(enrollmentId: string) {
      const client = getClient()

      const { data: enrollment, error: enrollError } = await client
        .from('enrollments')
        .select('curriculum_id, enrollment_type')
        .eq('id', enrollmentId)
        .single()

      if (enrollError || !enrollment) {
        return { data: [], error: enrollError }
      }

      const { data: tasks, error: tasksError } = await client
        .from('tasks')
        .select('id, title, position')
        .eq('curriculum_id', enrollment.curriculum_id)
        .order('position')

      if (tasksError || !tasks || tasks.length === 0) {
        return { data: [], error: tasksError }
      }

      const { data: playerTasks, error: ptError } = await client
        .from('player_tasks')
        .select('task_id, status, loop_number')
        .eq('enrollment_id', enrollmentId)

      if (ptError) {
        return { data: [], error: ptError }
      }

      // For memorization, only consider the current (max) loop
      const currentLoop =
        enrollment.enrollment_type === 'memorization' && playerTasks && playerTasks.length > 0
          ? Math.max(...playerTasks.map((pt) => pt.loop_number))
          : 1

      // Build set of non-pending task IDs for current loop
      const doneSet = new Set<string>()
      for (const pt of playerTasks ?? []) {
        if (enrollment.enrollment_type === 'memorization') {
          if (pt.loop_number === currentLoop && pt.status !== 'pending') {
            doneSet.add(pt.task_id)
          }
        } else {
          if (pt.status !== 'pending') {
            doneSet.add(pt.task_id)
          }
        }
      }

      // Return tasks that are pending (no record or status === 'pending')
      let pending = tasks
        .filter((t) => !doneSet.has(t.id))
        .map((t) => ({
          taskId: t.id,
          taskTitle: t.title,
          loopNumber: currentLoop,
        }))

      // For memorization: if no pending tasks in current loop, show next loop tasks
      if (pending.length === 0 && enrollment.enrollment_type === 'memorization') {
        // Check no promoted tasks remain in current loop
        const hasPromotedInLoop = (playerTasks ?? []).some(
          pt => pt.loop_number === currentLoop && pt.status === 'promoted'
        )
        if (!hasPromotedInLoop) {
          const skippedTaskIds = new Set(
            (playerTasks ?? []).filter(pt => pt.status === 'skipped').map(pt => pt.task_id)
          )
          const newLoop = currentLoop + 1
          pending = tasks
            .filter((t) => !skippedTaskIds.has(t.id))
            .map((t) => ({
              taskId: t.id,
              taskTitle: t.title,
              loopNumber: newLoop,
            }))
        }
      }

      return { data: pending, error: null }
    },

    async promoteTask(enrollmentId: string, taskId: string, loopNumber: number = 1) {
      const client = getClient()
      const now = new Date().toISOString()

      // Check if a player_task record already exists
      const { data: existing } = await client
        .from('player_tasks')
        .select('id, status')
        .eq('enrollment_id', enrollmentId)
        .eq('task_id', taskId)
        .eq('loop_number', loopNumber)
        .maybeSingle()

      if (existing) {
        // Already promoted — no-op
        if (existing.status === 'promoted') {
          return { data: existing, error: null }
        }
        // Update existing record
        return client
          .from('player_tasks')
          .update({ status: 'promoted', promoted_at: now })
          .eq('id', existing.id)
          .select()
          .single()
      }

      // Create new player_task with promoted status
      return client
        .from('player_tasks')
        .insert({
          enrollment_id: enrollmentId,
          task_id: taskId,
          status: 'promoted',
          promoted_at: now,
          loop_number: loopNumber,
        })
        .select()
        .single()
    },

    async getPromotedTasksForToday(playerId: string) {
      const client = getClient()

      // Get all active enrollments for this player
      const { data: enrollments, error: enrollErr } = await client
        .from('enrollments')
        .select('id')
        .eq('player_id', playerId)
        .eq('status', 'active')

      if (enrollErr || !enrollments || enrollments.length === 0) {
        return { data: [], error: enrollErr }
      }

      const enrollmentIds = enrollments.map((e) => e.id)

      // Get all promoted player_tasks for these enrollments, with task and enrollment+curriculum info
      return client
        .from('player_tasks')
        .select('*, tasks(*), enrollments(*, curricula(*))')
        .in('enrollment_id', enrollmentIds)
        .eq('status', 'promoted')
        .order('promoted_at', { ascending: true })
    },

    // `dateStr` is a YYYY-MM-DD calendar day and `timeZone` the player's IANA
    // zone; a task counts as "completed on dateStr" if its completed_at falls
    // on that day *in the player's zone*, not in the server's UTC.
    async getCompletedTasksToday(
      playerId: string,
      dateStr: string,
      timeZone: string
    ) {
      const client = getClient()

      // Get all active enrollments for this player
      const { data: enrollments, error: enrollErr } = await client
        .from('enrollments')
        .select('id')
        .eq('player_id', playerId)
        .eq('status', 'active')

      if (enrollErr || !enrollments || enrollments.length === 0) {
        return { data: [], error: enrollErr }
      }

      const enrollmentIds = enrollments.map((e) => e.id)

      // Fetch a UTC window one day wider on each side than dateStr — enough to
      // cover the player-local day under any zone offset — then keep only rows
      // that land on dateStr once converted to the player's zone.
      const windowStart = `${addDaysToDateKey(dateStr, -1)}T00:00:00.000Z`
      const windowEnd = `${addDaysToDateKey(dateStr, 1)}T23:59:59.999Z`

      const { data, error } = await client
        .from('player_tasks')
        .select('*, tasks(*), enrollments(*, curricula(*))')
        .in('enrollment_id', enrollmentIds)
        .eq('status', 'completed')
        .not('promoted_at', 'is', null)
        .gte('completed_at', windowStart)
        .lte('completed_at', windowEnd)
        .order('completed_at', { ascending: true })

      if (error || !data) return { data: data ?? [], error }

      const filtered = (data as Record<string, unknown>[]).filter(
        (row) => dateKeyInTimeZone(row.completed_at as string, timeZone) === dateStr
      )
      return { data: filtered, error: null }
    },

    async unpromoteTask(playerTaskId: string) {
      return getClient()
        .from('player_tasks')
        .update({ status: 'pending' as const, promoted_at: null })
        .eq('id', playerTaskId)
        .eq('status', 'promoted')
        .select()
        .single()
    },

    // Returns a player_task to the Plan inventory by clearing every today,
    // timer, and completion field. Used by:
    //   - the today-page finish modal when the user confirms 0 time spent
    //     (status='promoted', completion fields untouched)
    //   - the log-page Reset button on a curriculum task entry
    //     (status='completed' or 'skipped', completion fields populated)
    // The server action layer enforces ownership; this method is permissive
    // about the source status so both call sites can share it.
    async unfinishTask(playerTaskId: string) {
      return getClient()
        .from('player_tasks')
        .update({
          status: 'pending' as const,
          promoted_at: null,
          display_order: null,
          timer_started_at: null,
          accumulated_seconds: 0,
          started_at: null,
          completed_at: null,
          time_spent_minutes: null,
        })
        .eq('id', playerTaskId)
        .select()
        .single()
    },

    async startTask(playerTaskId: string, playerId: string) {
      const client = getClient()
      const now = new Date().toISOString()

      // Get all active enrollments for this player
      const { data: enrollments, error: enrollErr } = await client
        .from('enrollments')
        .select('id')
        .eq('player_id', playerId)
        .eq('status', 'active')

      if (enrollErr) return { data: null, error: enrollErr }
      if (!enrollments || enrollments.length === 0) {
        return { data: null, error: { message: 'No active enrollments found' } }
      }

      const enrollmentIds = enrollments.map((e: { id: string }) => e.id)

      // Find any currently active task (timer running) for this player
      const { data: activeTasks } = await client
        .from('player_tasks')
        .select('*')
        .in('enrollment_id', enrollmentIds)
        .eq('status', 'promoted')
        .not('timer_started_at', 'is', null)

      // Auto-pause each active task
      for (const activeTask of activeTasks ?? []) {
        if (activeTask.id === playerTaskId) continue

        const elapsed = Math.floor(
          (new Date(now).getTime() - new Date(activeTask.timer_started_at).getTime()) / 1000
        )
        const newAccumulated = (activeTask.accumulated_seconds ?? 0) + elapsed
        const pauseLog = [
          ...(activeTask.pause_log ?? []),
          { paused_at: now, unpaused_at: null },
        ]

        await client
          .from('player_tasks')
          .update({
            timer_started_at: null,
            accumulated_seconds: newAccumulated,
            pause_log: pauseLog,
          })
          .eq('id', activeTask.id)
      }

      // Read the target task to check if it's been started before
      const { data: task, error: taskErr } = await client
        .from('player_tasks')
        .select('*')
        .eq('id', playerTaskId)
        .single()

      if (taskErr || !task) {
        return { data: null, error: taskErr ?? { message: 'Task not found' } }
      }

      // Build update: set timer_started_at, and started_at on first start
      const updateData: Record<string, unknown> = {
        timer_started_at: now,
      }
      if (!task.started_at) {
        updateData.started_at = now
      }

      // If the task was previously paused, close the last open pause entry
      if (Array.isArray(task.pause_log) && task.pause_log.length > 0) {
        const lastEntry = task.pause_log[task.pause_log.length - 1]
        if (lastEntry && !lastEntry.unpaused_at) {
          const updatedLog = [...task.pause_log]
          updatedLog[updatedLog.length - 1] = { ...lastEntry, unpaused_at: now }
          updateData.pause_log = updatedLog
        }
      }

      return client
        .from('player_tasks')
        .update(updateData)
        .eq('id', playerTaskId)
        .select()
        .single()
    },

    async pauseTask(playerTaskId: string) {
      const client = getClient()
      const now = new Date().toISOString()

      // Read the task
      const { data: task, error: taskErr } = await client
        .from('player_tasks')
        .select('*')
        .eq('id', playerTaskId)
        .single()

      if (taskErr || !task) {
        return { data: null, error: taskErr ?? { message: 'Task not found' } }
      }

      if (!task.timer_started_at) {
        return { data: null, error: { message: 'Task is not currently active' } }
      }

      // Calculate elapsed seconds and add to accumulated
      const elapsed = Math.floor(
        (new Date(now).getTime() - new Date(task.timer_started_at).getTime()) / 1000
      )
      const newAccumulated = (task.accumulated_seconds ?? 0) + elapsed

      // Append pause entry
      const pauseLog = [
        ...(task.pause_log ?? []),
        { paused_at: now, unpaused_at: null },
      ]

      return client
        .from('player_tasks')
        .update({
          timer_started_at: null,
          accumulated_seconds: newAccumulated,
          pause_log: pauseLog,
        })
        .eq('id', playerTaskId)
        .select()
        .single()
    },

    async unpauseTask(playerTaskId: string, playerId: string) {
      // Unpause shares the same "only one active task" invariant as startTask
      return self.startTask(playerTaskId, playerId)
    },

    async completeTask(playerTaskId: string, confirmedSeconds?: number) {
      const client = getClient()
      const now = new Date().toISOString()

      // Read the task
      const { data: task, error: taskErr } = await client
        .from('player_tasks')
        .select('*')
        .eq('id', playerTaskId)
        .single()

      if (taskErr || !task) {
        return { data: null, error: taskErr ?? { message: 'Task not found' } }
      }

      // Calculate total seconds: use confirmedSeconds if provided, otherwise compute from timer
      let totalSeconds: number
      if (confirmedSeconds !== undefined) {
        totalSeconds = confirmedSeconds
      } else {
        totalSeconds = task.accumulated_seconds ?? 0
        if (task.timer_started_at) {
          const elapsed = Math.floor(
            (new Date(now).getTime() - new Date(task.timer_started_at).getTime()) / 1000
          )
          totalSeconds += elapsed
        }
      }

      // Clamp to 0–86400 (24 hours)
      totalSeconds = Math.max(0, Math.min(86400, totalSeconds))

      // Convert to minutes (integer — column is INTEGER)
      const timeSpentMinutes = Math.round(totalSeconds / 60)

      return client
        .from('player_tasks')
        .update({
          status: 'completed' as const,
          completed_at: now,
          time_spent_minutes: timeSpentMinutes,
          timer_started_at: null,
          accumulated_seconds: 0,
        })
        .eq('id', playerTaskId)
        .select()
        .single()
    },

    async clearTodayList(promotedTaskIds: string[], completedTaskIds: string[]) {
      const client = getClient()
      const results = await Promise.all([
        // Promoted tasks → return to pending, clear all today-related fields
        ...(promotedTaskIds.length > 0
          ? [
              client
                .from('player_tasks')
                .update({
                  status: 'pending' as const,
                  promoted_at: null,
                  display_order: null,
                  timer_started_at: null,
                  accumulated_seconds: 0,
                })
                .in('id', promotedTaskIds),
            ]
          : []),
        // Completed tasks → keep status/completed_at, clear promoted_at and display_order
        ...(completedTaskIds.length > 0
          ? [
              client
                .from('player_tasks')
                .update({
                  promoted_at: null,
                  display_order: null,
                })
                .in('id', completedTaskIds),
            ]
          : []),
      ])
      const firstError = results.find((r) => r.error)
      return { error: firstError?.error ?? null }
    },

    async deletePlayerTasksByEnrollment(enrollmentId: string) {
      return getClient()
        .from('player_tasks')
        .delete()
        .eq('enrollment_id', enrollmentId)
    },

    async deletePlayerTask(playerTaskId: string) {
      return getClient()
        .from('player_tasks')
        .delete()
        .eq('id', playerTaskId)
    },
  }
  return self
}
