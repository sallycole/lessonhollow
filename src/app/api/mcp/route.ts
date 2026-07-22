import { NextRequest, NextResponse } from 'next/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticateMcpRequest } from '@/lib/mcp-auth'
import { createMcpServer } from '@/lib/mcp/server'
import { checkApiRateLimit } from '@/lib/rate-limit'

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string
) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } }
}

export async function POST(request: NextRequest) {
  // Authenticate
  const authResult = await authenticateMcpRequest(
    request.headers.get('authorization')
  )
  if (!authResult.valid || !authResult.userId) {
    return NextResponse.json(
      jsonRpcError(null, -32000, authResult.error || 'Unauthorized'),
      { status: 401, headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${process.env.NEXT_PUBLIC_SITE_URL || 'https://lessonhollow.com'}/.well-known/oauth-protected-resource/api/mcp"`,
      } }
    )
  }

  // General API: 100 requests per user per minute
  const rateLimited = checkApiRateLimit(authResult.userId, 'mcp')
  if (rateLimited) return rateLimited

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  const server = createMcpServer(authResult.userId)
  await server.connect(transport)

  const response = await transport.handleRequest(request)

  await server.close()

  return response
}

/**
 * GET /api/mcp
 * Returns information about the MCP endpoint for discovery.
 */
export async function GET() {
  return NextResponse.json({
    name: 'lesson-hollow',
    version: '2.0.0',
    description:
      'MCP server for Lesson Hollow — manage players, curriculums, enrollments, tasks, and learning activities',
    transport: 'streamable-http',
    authentication: 'Bearer token (API key or Supabase access token)',
  })
}

/**
 * DELETE /api/mcp
 * Handle session termination (stateless, so this is a no-op).
 */
export async function DELETE() {
  return new NextResponse(null, { status: 405 })
}
