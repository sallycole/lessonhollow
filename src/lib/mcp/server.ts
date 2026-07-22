import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerPlayerTools } from './tools/players'
import { registerDashboardTools } from './tools/dashboard'
import { registerCurriculumTools } from './tools/curriculums'
import { registerEnrollmentTools } from './tools/enrollments'
import { registerTodayTools } from './tools/today'
import { registerPlanTools } from './tools/plan'
import { registerFeedTools } from './tools/feed'

/**
 * Creates and configures the MCP server with all Lesson Hollow tools.
 * Uses an admin client scoped to the authenticated guideId.
 */
export function createMcpServer(guideId: string) {
  const server = new McpServer(
    {
      name: 'lesson-hollow',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  registerPlayerTools(server, guideId)
  registerDashboardTools(server, guideId)
  registerCurriculumTools(server, guideId)
  registerEnrollmentTools(server, guideId)
  registerTodayTools(server, guideId)
  registerPlanTools(server, guideId)
  registerFeedTools(server, guideId)

  return server
}
