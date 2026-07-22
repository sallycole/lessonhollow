import type { SupabaseClient } from '@supabase/supabase-js'
import { countCompletedLoops } from '../loop-counter'
import { calculateProgressStatus } from '../progress-status'

export function createEnrollmentsDb(getClient: () => SupabaseClient) {
  return {
    async getEnrollmentsByPlayer(playerId: string) {
      return getClient()
        .from('enrollments')
        .select('*, curricula(*)')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
    },

    async getFinishedEnrollmentCurriculumIds(playerIds: string[]) {
      return getClient()
        .from('enrollments')
        .select('curriculum_id')
        .in('player_id', playerIds)
        .eq('status', 'finished')
    },

    async getActiveEnrollmentCountByPlayer(playerId: string) {
      return getClient()
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('player_id', playerId)
        .eq('status', 'active')
    },

    async getEnrollmentById(id: string) {
      return getClient()
        .from('enrollments')
        .select('*, curricula(*)')
        .eq('id', id)
        .single()
    },

    async getEnrollmentByPlayerAndCurriculum(playerId: string, curriculumId: string) {
      return getClient()
        .from('enrollments')
        .select('*')
        .eq('player_id', playerId)
        .eq('curriculum_id', curriculumId)
        .maybeSingle()
    },

    async createEnrollment(data: {
      player_id: string
      curriculum_id: string
      enrollment_type: 'core' | 'elective' | 'memorization'
      status?: 'active' | 'paused' | 'finished'
      target_completion_date?: string
      study_days_per_week?: number
      target_loops?: number
      start_date?: string
    }) {
      return getClient()
        .from('enrollments')
        .insert(data)
        .select()
        .single()
    },

    async updateEnrollment(
      id: string,
      data: Partial<{
        enrollment_type: 'core' | 'elective' | 'memorization'
        status: 'active' | 'paused' | 'finished'
        target_completion_date: string
        study_days_per_week: number
        target_loops: number
        start_date: string
      }>
    ) {
      return getClient()
        .from('enrollments')
        .update(data)
        .eq('id', id)
        .select()
        .single()
    },

    async deleteEnrollment(id: string) {
      return getClient()
        .from('enrollments')
        .delete()
        .eq('id', id)
    },

    async getActiveEnrollmentsWithCurricula(playerId: string) {
      return getClient()
        .from('enrollments')
        .select('*, curricula(*)')
        .eq('player_id', playerId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
    },

    async getTaskCountForCurriculum(curriculumId: string) {
      return getClient()
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('curriculum_id', curriculumId)
    },

    // `todayKey` is the player-local YYYY-MM-DD used for pacing/progress
    // status; callers that know the player's time zone should pass it so the
    // status doesn't flip a day early on the UTC server. Defaults to UTC today.
    async getEnrollmentStats(
      enrollmentId: string,
      todayKey: string = new Date().toISOString().split('T')[0]
    ) {
      const client = getClient()

      // Get enrollment with curriculum
      const { data: enrollment, error: enrollError } = await client
        .from('enrollments')
        .select('id, curriculum_id, enrollment_type, status, target_loops, target_completion_date, study_days_per_week, start_date, created_at, updated_at')
        .eq('id', enrollmentId)
        .single()

      if (enrollError || !enrollment) {
        return { data: null, error: enrollError }
      }

      const isMemo = enrollment.enrollment_type === 'memorization'

      // Run all counts/aggregates in parallel
      const [totalResult, doneResult, timeResult, loopDataResult] = await Promise.all([
        // Total tasks in curriculum
        client
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('curriculum_id', enrollment.curriculum_id),
        // Completed + skipped tasks for this enrollment
        client
          .from('player_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('enrollment_id', enrollmentId)
          .in('status', ['completed', 'skipped']),
        // Sum time_spent_minutes via fetching all completed tasks
        client
          .from('player_tasks')
          .select('time_spent_minutes')
          .eq('enrollment_id', enrollmentId)
          .not('time_spent_minutes', 'is', null),
        // For memorization: fetch all player_tasks for loop counting + current loop progress
        isMemo
          ? client
              .from('player_tasks')
              .select('task_id, status, loop_number')
              .eq('enrollment_id', enrollmentId)
          : Promise.resolve({ data: null }),
      ])

      const totalTasks = totalResult.count ?? 0
      const doneTasks = doneResult.count ?? 0
      const totalTimeMinutes = (timeResult.data ?? []).reduce(
        (sum: number, row: { time_spent_minutes: number }) => sum + (row.time_spent_minutes ?? 0),
        0
      )

      // Compute memorization loop data
      let completedLoops = 0
      let completedTasksInCurrentLoop = 0
      let effectiveTotalTasks = totalTasks
      if (isMemo && loopDataResult.data) {
        const playerTasks = loopDataResult.data as Array<{ task_id: string; status: string; loop_number: number }>
        completedLoops = countCompletedLoops(totalTasks, playerTasks)

        // Find permanently skipped tasks
        const skippedIds = new Set<string>()
        for (const pt of playerTasks) {
          if (pt.status === 'skipped') skippedIds.add(pt.task_id)
        }
        effectiveTotalTasks = totalTasks - skippedIds.size

        // Count completed tasks in current (next incomplete) loop
        const currentLoopNum = completedLoops + 1
        for (const pt of playerTasks) {
          if (pt.loop_number === currentLoopNum && pt.status === 'completed' && !skippedIds.has(pt.task_id)) {
            completedTasksInCurrentLoop++
          }
        }
      }

      // Calculate % complete
      let percentComplete: number
      if (isMemo) {
        const targetLoops = enrollment.target_loops ?? 1
        percentComplete = targetLoops > 0 ? Math.round((completedLoops / targetLoops) * 100) : 0
      } else {
        percentComplete = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
      }

      // Calculate weeks active (from start_date to now or updated_at for finished)
      const startDate = new Date(enrollment.start_date ?? enrollment.created_at)
      const endDate = enrollment.status === 'finished'
        ? new Date(enrollment.updated_at)
        : new Date()
      const msActive = endDate.getTime() - startDate.getTime()
      const weeksActive = Math.max(0, msActive) / (7 * 24 * 60 * 60 * 1000)

      // Calculate progress status (on-track indicator)
      const enrollmentStartDate: string =
        enrollment.start_date ?? enrollment.created_at.split('T')[0] // ISO date part
      const progressStatus = calculateProgressStatus(
        {
          enrollmentType: enrollment.enrollment_type,
          totalTasks,
          completedTasks: doneTasks,
          targetCompletionDate: enrollment.target_completion_date ?? null,
          startDate: enrollmentStartDate,
          targetLoops: enrollment.target_loops ?? 1,
          completedLoops: isMemo ? completedLoops : undefined,
          completedTasksInCurrentLoop: isMemo ? completedTasksInCurrentLoop : undefined,
          effectiveTotalTasks: isMemo ? effectiveTotalTasks : undefined,
        },
        todayKey
      )

      return {
        data: {
          totalTasks,
          doneTasks,
          percentComplete,
          totalTimeMinutes,
          weeksActive,
          completedLoops: isMemo ? completedLoops : undefined,
          targetLoops: isMemo ? (enrollment.target_loops ?? 1) : undefined,
          completedTasksInCurrentLoop: isMemo ? completedTasksInCurrentLoop : undefined,
          effectiveTotalTasks: isMemo ? effectiveTotalTasks : undefined,
          progressStatus,
        },
        error: null,
      }
    },

    async getCompletionDatesByEnrollment(enrollmentIds: string[]) {
      if (enrollmentIds.length === 0) return { data: [], error: null }
      return getClient()
        .from('player_tasks')
        .select('enrollment_id, completed_at, status')
        .in('enrollment_id', enrollmentIds)
        .in('status', ['completed', 'skipped'])
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: true })
    },

    async getCurriculumCountByUser(userId: string) {
      return getClient()
        .from('curricula')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
    },

    async getCompletedTaskCountForEnrollment(enrollmentId: string) {
      return getClient()
        .from('player_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'completed')
    },

    async getCompletedTaskTitlesForEnrollment(enrollmentId: string) {
      return getClient()
        .from('player_tasks')
        .select('tasks(title, description)')
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: true })
    },

    async getCompletedTasksForEnrollmentOnDate(enrollmentId: string, dateStr: string) {
      const dayStart = `${dateStr}T00:00:00.000Z`
      const dayEnd = `${dateStr}T23:59:59.999Z`
      return getClient()
        .from('player_tasks')
        .select('tasks(title, description, action_type, resource_url), time_spent_minutes, status, completed_at, notes, photo_url')
        .eq('enrollment_id', enrollmentId)
        .in('status', ['completed', 'skipped'])
        .gte('completed_at', dayStart)
        .lte('completed_at', dayEnd)
        .order('completed_at', { ascending: true })
    },

    async getCompletedTaskTitlesForPeriod(playerId: string, startDate: string, endDate: string) {
      const client = getClient()
      const dayStart = `${startDate}T00:00:00.000Z`
      const dayEnd = `${endDate}T23:59:59.999Z`

      // Get player's enrollment IDs
      const { data: enrollments, error: enrollErr } = await client
        .from('enrollments')
        .select('id, curricula(name)')
        .eq('player_id', playerId)

      if (enrollErr || !enrollments) {
        return { data: null, error: enrollErr }
      }

      const enrollmentIds = enrollments.map((e: { id: string }) => e.id)
      if (enrollmentIds.length === 0) {
        return { data: [], error: null }
      }

      const enrollmentNameMap = new Map<string, string>()
      for (const e of enrollments) {
        const curriculum = e.curricula as unknown as { name: string } | null
        enrollmentNameMap.set(e.id as string, curriculum?.name ?? 'Unknown')
      }

      const { data: tasks, error: taskErr } = await client
        .from('player_tasks')
        .select('enrollment_id, time_spent_minutes, tasks(title)')
        .in('enrollment_id', enrollmentIds)
        .eq('status', 'completed')
        .gte('completed_at', dayStart)
        .lte('completed_at', dayEnd)
        .order('completed_at', { ascending: true })

      if (taskErr) {
        return { data: null, error: taskErr }
      }

      const result = (tasks ?? []).map((t: Record<string, unknown>) => {
        const task = t.tasks as { title: string } | null
        return {
          title: task?.title ?? 'Untitled',
          timeMinutes: (t.time_spent_minutes as number) ?? 0,
          curriculumName: enrollmentNameMap.get(t.enrollment_id as string) ?? 'Unknown',
        }
      })

      return { data: result, error: null }
    },

    async getCompletedLoopCountForEnrollment(enrollmentId: string) {
      const client = getClient()

      // Get enrollment for curriculum_id
      const { data: enrollment } = await client
        .from('enrollments')
        .select('curriculum_id')
        .eq('id', enrollmentId)
        .single()

      if (!enrollment) return 0

      // Get total tasks in curriculum
      const { count: totalTasks } = await client
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('curriculum_id', enrollment.curriculum_id)

      if (!totalTasks || totalTasks === 0) return 0

      // Get all player_tasks for this enrollment
      const { data: playerTasks } = await client
        .from('player_tasks')
        .select('task_id, status, loop_number')
        .eq('enrollment_id', enrollmentId)

      if (!playerTasks || playerTasks.length === 0) return 0

      return countCompletedLoops(totalTasks, playerTasks)
    },

    // --- Tasks with Player Status ---

    async getTasksWithPlayerStatus(enrollmentId: string) {
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

      // Get all tasks for the curriculum
      const { data: tasks, error: tasksError } = await client
        .from('tasks')
        .select('*')
        .eq('curriculum_id', enrollment.curriculum_id)
        .order('position')

      if (tasksError) {
        return { data: null, error: tasksError }
      }

      // Get player_tasks for this enrollment
      const { data: playerTasks, error: ptError } = await client
        .from('player_tasks')
        .select('task_id, status, loop_number')
        .eq('enrollment_id', enrollmentId)

      if (ptError) {
        return { data: null, error: ptError }
      }

      // For memorization, only show status for the current (max) loop
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

      const tasksWithStatus = (tasks ?? []).map((task) => ({
        ...task,
        player_status: (statusMap.get(task.id) as 'pending' | 'completed' | 'skipped' | 'promoted') ?? 'pending',
      }))

      return { data: tasksWithStatus, error: null }
    },
  }
}
