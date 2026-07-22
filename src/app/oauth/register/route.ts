import { NextRequest, NextResponse } from 'next/server'
import { OAuthClientMetadataSchema } from '@modelcontextprotocol/sdk/shared/auth.js'
import { clientsStore } from '@/lib/oauth/clients-store'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const { allowed, retryAfterMs } = checkRateLimit(`oauth-register:${ip}`, 20, 3600_000)
  if (!allowed) {
    return NextResponse.json(
      { error: 'too_many_requests', error_description: 'Rate limit exceeded.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
      }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Invalid JSON body.' },
      { status: 400 }
    )
  }

  const parsed = OAuthClientMetadataSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid_client_metadata',
        error_description: parsed.error.issues.map((i) => i.message).join('; '),
      },
      { status: 400 }
    )
  }

  try {
    const client = await clientsStore.registerClient(parsed.data)
    return NextResponse.json(client, {
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: err instanceof Error ? err.message : 'Registration failed.',
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
