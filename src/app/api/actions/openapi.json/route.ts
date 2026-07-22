import { NextResponse } from 'next/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lessonhollow.com'

type ToolSpec = {
  summary: string
  description: string
  properties?: Record<string, { type: string; description: string; enum?: string[] }>
  required?: string[]
}

// Tool definitions derived from MCP tool schemas
const TOOLS: Record<string, ToolSpec> = {
  // Players
  list_players: {
    summary: 'List all players',
    description: 'List all players (students/learners) on your account with their timezones and active enrollment counts.',
    properties: {},
  },
  get_player: {
    summary: 'Get player details',
    description: 'Look up a player by name, username, or ID.',
    properties: {
      player: { type: 'string', description: 'Player first name, username, or ID' },
    },
  },
  create_player: {
    summary: 'Create a player',
    description: 'Create a new player (student/learner) account.',
    properties: {
      first_name: { type: 'string', description: 'First name' },
      last_name: { type: 'string', description: 'Last name' },
      username: { type: 'string', description: 'Username (letters, numbers, hyphens, underscores)' },
      time_zone: { type: 'string', description: 'IANA timezone (e.g., America/New_York)' },
      password: { type: 'string', description: 'Password (minimum 8 characters)' },
    },
    required: ['first_name', 'username', 'time_zone', 'password'],
  },
  update_player: {
    summary: 'Update a player',
    description: "Edit an existing player's details.",
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      first_name: { type: 'string', description: 'New first name' },
      last_name: { type: 'string', description: 'New last name' },
      username: { type: 'string', description: 'New username' },
      time_zone: { type: 'string', description: 'New timezone' },
    },
    required: ['player'],
  },

  // Dashboard
  get_dashboard: {
    summary: 'Get dashboard overview',
    description: 'Overview of all players with their enrollments, pacing, and completion stats.',
    properties: {},
  },
  get_player_enrollments: {
    summary: 'Get player enrollments',
    description: 'Detailed enrollment info for a player including pacing and completion stats.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      status: { type: 'string', description: 'Filter by status', enum: ['active', 'paused', 'finished'] },
    },
    required: ['player'],
  },

  // Curriculums
  list_curriculums: {
    summary: 'List all curriculums',
    description: 'List all curriculums across all players, showing task counts and ownership.',
    properties: {},
  },
  get_curriculum: {
    summary: 'Get curriculum details',
    description: 'View a curriculum and its full task list.',
    properties: {
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
    },
    required: ['curriculum'],
  },
  create_curriculum: {
    summary: 'Create a curriculum',
    description: 'Create a new curriculum under a player account.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      name: { type: 'string', description: 'Curriculum name' },
      description: { type: 'string', description: 'Description' },
      publisher: { type: 'string', description: 'Publisher' },
      grade_level: { type: 'string', description: 'Grade level' },
      resource_url: { type: 'string', description: 'Resource URL' },
    },
    required: ['player', 'name'],
  },
  update_curriculum: {
    summary: 'Update a curriculum',
    description: 'Edit curriculum metadata.',
    properties: {
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
      name: { type: 'string', description: 'New name' },
      description: { type: 'string', description: 'New description' },
      publisher: { type: 'string', description: 'New publisher' },
      grade_level: { type: 'string', description: 'New grade level' },
      resource_url: { type: 'string', description: 'New resource URL' },
    },
    required: ['curriculum'],
  },
  add_task: {
    summary: 'Add a task to a curriculum',
    description: "Add a new task to a curriculum's task list.",
    properties: {
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
      title: { type: 'string', description: 'Task title' },
      description: { type: 'string', description: 'Task description' },
      action_type: { type: 'string', description: 'Action type', enum: ['Read', 'Watch', 'Listen', 'Do'] },
      resource_url: { type: 'string', description: 'Resource URL' },
      position: { type: 'number', description: 'Position to insert at' },
    },
    required: ['curriculum', 'title'],
  },
  update_task: {
    summary: 'Update a task',
    description: 'Edit an existing task in a curriculum.',
    properties: {
      task_id: { type: 'string', description: 'Task ID, or the task title / 1-based number if curriculum is given' },
      curriculum: { type: 'string', description: 'Curriculum name or ID. Lets you target the task by title or number instead of its ID.' },
      title: { type: 'string', description: 'New title' },
      description: { type: 'string', description: 'New description' },
      action_type: { type: 'string', description: 'New action type', enum: ['Read', 'Watch', 'Listen', 'Do'] },
      resource_url: { type: 'string', description: 'New resource URL' },
    },
    required: ['task_id'],
  },
  delete_task: {
    summary: 'Delete a task',
    description: "Delete a task from a curriculum's task list. Also removes it from every enrolled player's progress and history. Cannot be undone.",
    properties: {
      task_id: { type: 'string', description: 'Task ID, or the task title / 1-based number if curriculum is given' },
      curriculum: { type: 'string', description: 'Curriculum name or ID. Lets you target the task by title or number instead of its ID.' },
    },
    required: ['task_id'],
  },
  reorder_tasks: {
    summary: 'Reorder tasks',
    description: 'Reorder tasks within a curriculum.',
    properties: {
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
      task_ids: { type: 'string', description: 'JSON array of task IDs in desired order' },
    },
    required: ['curriculum', 'task_ids'],
  },
  import_tasks_csv: {
    summary: 'Import tasks from CSV',
    description: 'Import tasks into a curriculum from CSV data.',
    properties: {
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
      csv_data: { type: 'string', description: 'CSV string with columns: title, description, action_type, resource_url' },
      mode: { type: 'string', description: "'append' (default) adds rows after existing tasks; 'replace' makes the task list match the CSV exactly, matching by title to preserve progress on kept tasks and deleting tasks absent from the CSV.", enum: ['append', 'replace'] },
    },
    required: ['curriculum', 'csv_data'],
  },
  export_curriculum_csv: {
    summary: 'Export curriculum as CSV',
    description: 'Export a curriculum and its tasks as CSV.',
    properties: {
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
    },
    required: ['curriculum'],
  },

  // Enrollments
  enroll_player: {
    summary: 'Enroll a player',
    description: 'Enroll a player in a curriculum. Types: core (deadline-driven), elective (flexible), memorization (looping).',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
      enrollment_type: { type: 'string', description: 'Enrollment type', enum: ['core', 'elective', 'memorization'] },
      target_completion_date: { type: 'string', description: 'Target date (ISO 8601)' },
      start_date: { type: 'string', description: 'Start date (ISO 8601). Defaults to today; pacing counts nothing as behind before it' },
      study_days_per_week: { type: 'number', description: 'Study days per week (0.5-7)' },
      target_loops: { type: 'number', description: 'Number of loops (memorization only)' },
    },
    required: ['player', 'curriculum', 'enrollment_type'],
  },
  update_enrollment: {
    summary: 'Update an enrollment',
    description: 'Edit enrollment settings.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
      enrollment_type: { type: 'string', description: 'New enrollment type', enum: ['core', 'elective', 'memorization'] },
      target_completion_date: { type: 'string', description: 'New target date (ISO 8601)' },
      start_date: { type: 'string', description: 'New start date (ISO 8601)' },
      study_days_per_week: { type: 'number', description: 'New study days per week' },
      target_loops: { type: 'number', description: 'New target loops' },
    },
    required: ['player', 'curriculum'],
  },
  pause_enrollment: {
    summary: 'Pause an enrollment',
    description: 'Pause an active enrollment.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
    },
    required: ['player', 'curriculum'],
  },
  resume_enrollment: {
    summary: 'Resume an enrollment',
    description: 'Resume a paused enrollment.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
    },
    required: ['player', 'curriculum'],
  },
  finish_enrollment: {
    summary: 'Finish an enrollment',
    description: 'Permanently mark an enrollment as finished (cannot be undone).',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
    },
    required: ['player', 'curriculum'],
  },
  unenroll_player: {
    summary: 'Unenroll a player',
    description: 'Remove a player from a curriculum entirely.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
    },
    required: ['player', 'curriculum'],
  },

  // Today
  get_today: {
    summary: "Get today's tasks",
    description: "Get a player's task list for today with full details including titles, URLs, timer status, and notes.",
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
    },
    required: ['player'],
  },
  get_today_summary: {
    summary: "Get today's summary",
    description: 'Quick progress snapshot for today (completed vs remaining, total time spent).',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
    },
    required: ['player'],
  },
  complete_task: {
    summary: 'Complete a task',
    description: "Mark a task on today's list as complete.",
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      task: { type: 'string', description: 'Task title or player_task ID' },
      notes: { type: 'string', description: 'Completion notes' },
      time_spent_minutes: { type: 'number', description: 'Manual time override in minutes' },
    },
    required: ['player', 'task'],
  },
  unfinish_task: {
    summary: 'Return a today task to the Plan inventory',
    description: "Return a TODAY task (status=promoted) to the Plan inventory as not finished. Use only on tasks currently on today; for completed/skipped tasks in the log, use reset_task instead.",
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      task: { type: 'string', description: 'Task title or player_task ID from today' },
      notes: { type: 'string', description: 'Why the task is being returned to the Plan' },
    },
    required: ['player', 'task'],
  },
  reset_task: {
    summary: 'Reset a completed or skipped task back to the Plan inventory',
    description: "Reset a completed or skipped task back to the Plan inventory. Wipes recorded time. Use only on tasks in the log; for a task currently on today, use unfinish_task. If multiple historical entries match by title, the most recent is used.",
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      task: { type: 'string', description: 'Task title or player_task ID from the log' },
      notes: { type: 'string', description: 'Why the task is being reset' },
    },
    required: ['player', 'task'],
  },
  skip_task: {
    summary: 'Skip a task',
    description: 'Skip a task on today without completing it.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      task: { type: 'string', description: 'Task title or player_task ID' },
    },
    required: ['player', 'task'],
  },
  start_task: {
    summary: 'Start task timer',
    description: 'Start the timer on a task.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      task: { type: 'string', description: 'Task title or player_task ID' },
    },
    required: ['player', 'task'],
  },
  pause_task: {
    summary: 'Pause task timer',
    description: 'Pause the timer on an in-progress task.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      task: { type: 'string', description: 'Task title or player_task ID' },
    },
    required: ['player', 'task'],
  },
  resume_task: {
    summary: 'Resume task timer',
    description: 'Resume the timer on a paused task.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      task: { type: 'string', description: 'Task title or player_task ID' },
    },
    required: ['player', 'task'],
  },
  reorder_today: {
    summary: "Reorder today's tasks",
    description: "Reorder tasks on a player's today page.",
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      task_ids: { type: 'string', description: 'JSON array of player_task IDs in desired order' },
    },
    required: ['player', 'task_ids'],
  },
  clear_today: {
    summary: 'Clear today',
    description: 'End the day — moves unfinished tasks back to curriculum queues.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
    },
    required: ['player'],
  },

  // Plan
  get_upcoming_tasks: {
    summary: 'Get upcoming tasks',
    description: "Preview the next pending tasks in a player's curriculum queue.",
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      curriculum: { type: 'string', description: 'Curriculum name or ID (optional filter)' },
      limit: { type: 'number', description: 'Number of tasks to return (default 5)' },
    },
    required: ['player'],
  },
  plan_tasks: {
    summary: 'Plan tasks for today',
    description: "Add pending tasks to a player's Today queue.",
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      curriculum: { type: 'string', description: 'Curriculum name or ID' },
      count: { type: 'number', description: 'Number of next tasks to add (default 1)' },
      task_ids: { type: 'string', description: 'JSON array of specific task IDs to add' },
    },
    required: ['player'],
  },

  // Feed/Log
  get_log: {
    summary: 'Get activity log',
    description: "View a player's completed work and logged activities over a date range.",
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      range: { type: 'string', description: 'Time range', enum: ['daily', 'weekly', 'monthly', 'yearly'] },
      date: { type: 'string', description: 'Reference date (ISO 8601, defaults to today)' },
    },
    required: ['player'],
  },
  add_task_notes: {
    summary: 'Add task notes',
    description: 'Add or update notes on a completed task.',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      task: { type: 'string', description: 'Task title or player_task ID' },
      notes: { type: 'string', description: 'Notes text' },
    },
    required: ['player', 'task', 'notes'],
  },
  log_activity: {
    summary: 'Log an activity',
    description: 'Log a learning activity outside a curriculum (field trip, documentary, project).',
    properties: {
      player: { type: 'string', description: 'Player name, username, or ID' },
      title: { type: 'string', description: 'Title of activity' },
      started_at: { type: 'string', description: 'Start date/time (ISO 8601)' },
      ended_at: { type: 'string', description: 'End date/time (ISO 8601)' },
      description: { type: 'string', description: 'Description' },
      action_type: { type: 'string', description: 'Action type', enum: ['Read', 'Watch', 'Listen', 'Do'] },
      resource_url: { type: 'string', description: 'URL of resource used' },
      notes: { type: 'string', description: 'Notes' },
    },
    required: ['player', 'title', 'started_at', 'ended_at'],
  },
}

function buildOpenApiSpec() {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const [name, tool] of Object.entries(TOOLS)) {
    const properties: Record<string, unknown> = {}
    for (const [propName, propDef] of Object.entries(tool.properties ?? {})) {
      const prop: Record<string, unknown> = {
        type: propDef.type,
        description: propDef.description,
      }
      if (propDef.enum) prop.enum = propDef.enum
      properties[propName] = prop
    }

    const hasBody = Object.keys(properties).length > 0

    paths[`/api/actions/${name}`] = {
      post: {
        operationId: name,
        summary: tool.summary,
        description: tool.description,
        ...(hasBody
          ? {
              requestBody: {
                required: (tool.required?.length ?? 0) > 0,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties,
                      ...(tool.required ? { required: tool.required } : {}),
                    },
                  },
                },
              },
            }
          : {}),
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
              },
            },
          },
          '401': { description: 'Unauthorized' },
          '422': { description: 'Action error' },
        },
      },
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Lesson Hollow',
      description:
        'Lesson Hollow is a curriculum-based learning platform. Manage players, curricula, enrollments, daily tasks, and learning logs.',
      version: '2.0.0',
    },
    servers: [{ url: SITE_URL }],
    paths,
    components: {
      securitySchemes: {
        oauth2: {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: `${SITE_URL}/oauth/authorize`,
              tokenUrl: `${SITE_URL}/oauth/token`,
              scopes: {
                mcp: 'Full access to Lesson Hollow data and actions',
              },
            },
          },
        },
      },
    },
    security: [{ oauth2: ['mcp'] }],
  }
}

export async function GET() {
  return NextResponse.json(buildOpenApiSpec(), {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
