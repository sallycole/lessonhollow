import { randomBytes } from 'crypto'
import { verifyChallenge } from 'pkce-challenge'
import type { OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { hashApiKey } from '@/lib/mcp-auth'
import { db } from '@/lib/db'

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

function expiresAtISO(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

const ACCESS_TOKEN_TTL = 60 * 60           // 1 hour
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 // 30 days
const AUTH_CODE_TTL = 10 * 60               // 10 minutes

export async function generateAuthorizationCode(params: {
  clientId: string
  userId: string
  redirectUri: string
  codeChallenge: string
  scopes?: string[]
  state?: string
  resource?: string
}): Promise<string> {
  const rawCode = generateToken()
  const codeHash = hashApiKey(rawCode)

  const { error } = await db.createAuthorizationCode({
    code_hash: codeHash,
    client_id: params.clientId,
    user_id: params.userId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    scopes: params.scopes ?? null,
    state: params.state ?? null,
    resource: params.resource ?? null,
    expires_at: expiresAtISO(AUTH_CODE_TTL),
  })

  if (error) throw new Error(`Failed to store authorization code: ${error.message}`)

  return rawCode
}

export async function exchangeAuthorizationCode(params: {
  clientId: string
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<OAuthTokens> {
  const codeHash = hashApiKey(params.code)
  const { data: codeRecord, error } = await db.getAuthorizationCode(codeHash)

  if (error || !codeRecord) {
    throw new Error('Invalid authorization code.')
  }

  if (codeRecord.used) {
    throw new Error('Authorization code already used.')
  }

  if (new Date(codeRecord.expires_at) < new Date()) {
    throw new Error('Authorization code expired.')
  }

  if (codeRecord.client_id !== params.clientId) {
    throw new Error('Client ID mismatch.')
  }

  if (codeRecord.redirect_uri !== params.redirectUri) {
    throw new Error('Redirect URI mismatch.')
  }

  // PKCE verification
  const pkceValid = await verifyChallenge(params.codeVerifier, codeRecord.code_challenge)
  if (!pkceValid) {
    throw new Error('PKCE verification failed.')
  }

  // Mark code as used (atomically — returns null if already used)
  const { data: marked } = await db.markAuthorizationCodeUsed(codeHash)
  if (!marked) {
    throw new Error('Authorization code already used.')
  }

  // Generate tokens
  const rawAccessToken = generateToken()
  const rawRefreshToken = generateToken()

  const scopes = codeRecord.scopes ?? ['mcp']

  await Promise.all([
    db.createOAuthToken({
      token_hash: hashApiKey(rawAccessToken),
      client_id: params.clientId,
      user_id: codeRecord.user_id,
      scopes,
      token_type: 'access',
      expires_at: expiresAtISO(ACCESS_TOKEN_TTL),
      resource: codeRecord.resource ?? null,
    }),
    db.createOAuthToken({
      token_hash: hashApiKey(rawRefreshToken),
      client_id: params.clientId,
      user_id: codeRecord.user_id,
      scopes,
      token_type: 'refresh',
      expires_at: expiresAtISO(REFRESH_TOKEN_TTL),
      resource: codeRecord.resource ?? null,
    }),
  ])

  return {
    access_token: rawAccessToken,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: rawRefreshToken,
    scope: scopes.join(' '),
  }
}

export async function exchangeRefreshToken(params: {
  clientId: string
  refreshToken: string
}): Promise<OAuthTokens> {
  const tokenHash = hashApiKey(params.refreshToken)
  const { data: tokenRecord, error } = await db.getOAuthToken(tokenHash)

  if (error || !tokenRecord) {
    throw new Error('Invalid refresh token.')
  }

  if (tokenRecord.token_type !== 'refresh') {
    throw new Error('Token is not a refresh token.')
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw new Error('Refresh token expired.')
  }

  if (tokenRecord.client_id !== params.clientId) {
    throw new Error('Client ID mismatch.')
  }

  // Revoke old refresh token (single-use rotation)
  await db.revokeOAuthToken(tokenHash)

  // Generate new tokens
  const rawAccessToken = generateToken()
  const rawRefreshToken = generateToken()
  const scopes = tokenRecord.scopes ?? ['mcp']

  await Promise.all([
    db.createOAuthToken({
      token_hash: hashApiKey(rawAccessToken),
      client_id: params.clientId,
      user_id: tokenRecord.user_id,
      scopes,
      token_type: 'access',
      expires_at: expiresAtISO(ACCESS_TOKEN_TTL),
      resource: tokenRecord.resource ?? null,
    }),
    db.createOAuthToken({
      token_hash: hashApiKey(rawRefreshToken),
      client_id: params.clientId,
      user_id: tokenRecord.user_id,
      scopes,
      token_type: 'refresh',
      expires_at: expiresAtISO(REFRESH_TOKEN_TTL),
      resource: tokenRecord.resource ?? null,
    }),
  ])

  return {
    access_token: rawAccessToken,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: rawRefreshToken,
    scope: scopes.join(' '),
  }
}

export async function verifyAccessToken(token: string): Promise<AuthInfo & { userId: string }> {
  const tokenHash = hashApiKey(token)
  const { data: tokenRecord, error } = await db.getOAuthToken(tokenHash)

  if (error || !tokenRecord) {
    throw new Error('Invalid access token.')
  }

  if (tokenRecord.token_type !== 'access') {
    throw new Error('Token is not an access token.')
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw new Error('Access token expired.')
  }

  return {
    token,
    clientId: tokenRecord.client_id,
    scopes: tokenRecord.scopes ?? [],
    expiresAt: Math.floor(new Date(tokenRecord.expires_at).getTime() / 1000),
    userId: tokenRecord.user_id,
  }
}
