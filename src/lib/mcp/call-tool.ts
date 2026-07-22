import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from './server'

/**
 * Call an MCP tool programmatically without HTTP transport.
 * Uses an in-memory client/server pair for zero-overhead tool invocation.
 */
export async function callMcpTool(
  guideId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  const server = createMcpServer(guideId)
  const client = new Client({ name: 'actions-bridge', version: '1.0.0' })

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ])

  try {
    const result = await client.callTool({ name: toolName, arguments: args })

    const content = result.content as Array<{ type: string; text?: string }>
    const text = content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text!)
      .join('\n')

    return { text, isError: result.isError === true }
  } finally {
    await client.close()
    await server.close()
  }
}
