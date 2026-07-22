import { NextRequest, NextResponse } from 'next/server'
import { authenticateMcpRequest } from '@/lib/mcp-auth'
import { callMcpTool } from '@/lib/mcp/call-tool'

// All valid tool names (used for validation)
const VALID_TOOLS = new Set([
  'list_players', 'get_player', 'create_player', 'update_player',
  'get_dashboard', 'get_player_enrollments',
  'list_curriculums', 'get_curriculum', 'create_curriculum', 'update_curriculum',
  'add_task', 'update_task', 'reorder_tasks', 'import_tasks_csv', 'export_curriculum_csv',
  'enroll_player', 'update_enrollment', 'pause_enrollment', 'resume_enrollment',
  'finish_enrollment', 'unenroll_player',
  'get_today', 'get_today_summary', 'complete_task', 'unfinish_task', 'reset_task', 'skip_task',
  'start_task', 'pause_task', 'resume_task', 'reorder_today', 'clear_today',
  'get_upcoming_tasks', 'plan_tasks',
  'get_log', 'add_task_notes', 'log_activity',
])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params

  if (!VALID_TOOLS.has(tool)) {
    return NextResponse.json(
      { error: `Unknown action: ${tool}` },
      { status: 404 },
    )
  }

  // Authenticate
  const authResult = await authenticateMcpRequest(
    request.headers.get('authorization'),
  )

  if (!authResult.valid || !authResult.userId) {
    return NextResponse.json(
      { error: authResult.error ?? 'Unauthorized' },
      { status: 401 },
    )
  }

  // Parse request body
  let args: Record<string, unknown> = {}
  try {
    const body = await request.text()
    if (body) {
      args = JSON.parse(body)
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  // Call the MCP tool
  const result = await callMcpTool(authResult.userId, tool, args)

  if (result.isError) {
    return NextResponse.json(
      { error: result.text },
      { status: 422 },
    )
  }

  // Try to parse the text as JSON for a cleaner response
  try {
    const parsed = JSON.parse(result.text)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ result: result.text })
  }
}
