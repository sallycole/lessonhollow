import { NextRequest, NextResponse } from 'next/server'
import { clientsStore } from '@/lib/oauth/clients-store'
import { hashApiKey } from '@/lib/mcp-auth'
import {
  exchangeAuthorizationCode,
  exchangeRefreshToken,
} from '@/lib/oauth/provider'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
}

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: CORS_HEADERS }
  )
}

export async function POST(request: NextRequest) {
  // Parse application/x-www-form-urlencoded body
  let body: URLSearchParams
  try {
    const text = await request.text()
    body = new URLSearchParams(text)
  } catch {
    return oauthError('invalid_request', 'Could not parse request body.')
  }

  const grantType = body.get('grant_type')
  const clientId = body.get('client_id')

  if (!clientId) {
    return oauthError('invalid_request', 'Missing client_id.')
  }

  // Look up and authenticate client
  const client = await clientsStore.getClient(clientId)
  if (!client) {
    return oauthError('invalid_client', 'Unknown client_id.', 401)
  }

  // Validate client_secret if client uses secret-based auth
  const authMethod = client.token_endpoint_auth_method ?? 'none'
  if (authMethod !== 'none') {
    const clientSecret = body.get('client_secret')
    if (!clientSecret) {
      return oauthError('invalid_client', 'Missing client_secret.', 401)
    }
    // We need to re-fetch to get the hash — but the store doesn't expose it.
    // Look up directly from DB for secret verification.
    const { db } = await import('@/lib/db')
    const { data: clientRecord } = await db.getOAuthClient(clientId)
    if (!clientRecord?.client_secret_hash) {
      return oauthError('invalid_client', 'Client has no secret configured.', 401)
    }
    if (hashApiKey(clientSecret) !== clientRecord.client_secret_hash) {
      return oauthError('invalid_client', 'Invalid client_secret.', 401)
    }
  }

  try {
    if (grantType === 'authorization_code') {
      const code = body.get('code')
      const codeVerifier = body.get('code_verifier')
      const redirectUri = body.get('redirect_uri')

      if (!code || !codeVerifier || !redirectUri) {
        return oauthError('invalid_request', 'Missing code, code_verifier, or redirect_uri.')
      }

      const tokens = await exchangeAuthorizationCode({
        clientId,
        code,
        codeVerifier,
        redirectUri,
      })

      return NextResponse.json(tokens, { headers: CORS_HEADERS })
    }

    if (grantType === 'refresh_token') {
      const refreshToken = body.get('refresh_token')
      if (!refreshToken) {
        return oauthError('invalid_request', 'Missing refresh_token.')
      }

      const tokens = await exchangeRefreshToken({
        clientId,
        refreshToken,
      })

      return NextResponse.json(tokens, { headers: CORS_HEADERS })
    }

    return oauthError('unsupported_grant_type', `Unsupported grant_type: ${grantType}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token exchange failed.'
    return oauthError('invalid_grant', message)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
