import { randomUUID, randomBytes } from 'crypto'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js'
import { hashApiKey } from '@/lib/mcp-auth'
import { db } from '@/lib/db'

/**
 * Supabase-backed client store for OAuth Dynamic Client Registration (RFC 7591).
 */
export class SupabaseClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const { data, error } = await db.getOAuthClient(clientId)
    if (error || !data) return undefined

    const redirectUris = (typeof data.redirect_uris === 'string'
      ? JSON.parse(data.redirect_uris)
      : data.redirect_uris) as string[]

    return {
      client_id: data.client_id,
      client_id_issued_at: data.client_id_issued_at,
      client_secret_expires_at: data.client_secret_expires_at ?? undefined,
      redirect_uris: redirectUris,
      client_name: data.client_name ?? undefined,
      client_uri: data.client_uri ? (data.client_uri as unknown as URL) : undefined,
      logo_uri: data.logo_uri ?? undefined,
      token_endpoint_auth_method: data.token_endpoint_auth_method ?? 'none',
      grant_types: (typeof data.grant_types === 'string'
        ? JSON.parse(data.grant_types)
        : data.grant_types) ?? undefined,
      response_types: (typeof data.response_types === 'string'
        ? JSON.parse(data.response_types)
        : data.response_types) ?? undefined,
      scope: data.scope ?? undefined,
    } as OAuthClientInformationFull
  }

  async registerClient(
    metadata: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>
  ): Promise<OAuthClientInformationFull> {
    const clientId = randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // Generate secret for confidential clients
    let clientSecret: string | undefined
    let clientSecretHash: string | null = null
    const authMethod = metadata.token_endpoint_auth_method ?? 'none'
    if (authMethod !== 'none') {
      clientSecret = randomBytes(32).toString('hex')
      clientSecretHash = hashApiKey(clientSecret)
    }

    const secretExpiresAt = clientSecret ? now + 30 * 24 * 60 * 60 : null // 30 days

    const redirectUris = (metadata.redirect_uris ?? []).map((u) => String(u))

    const { error } = await db.createOAuthClient({
      client_id: clientId,
      client_secret_hash: clientSecretHash,
      client_id_issued_at: now,
      client_secret_expires_at: secretExpiresAt,
      redirect_uris: redirectUris,
      client_name: metadata.client_name ?? null,
      client_uri: metadata.client_uri ? String(metadata.client_uri) : null,
      logo_uri: metadata.logo_uri ? String(metadata.logo_uri) : null,
      token_endpoint_auth_method: authMethod,
      grant_types: metadata.grant_types as string[] ?? null,
      response_types: metadata.response_types as string[] ?? null,
      scope: metadata.scope ?? null,
    })

    if (error) throw new Error(`Failed to register client: ${error.message}`)

    return {
      ...metadata,
      client_id: clientId,
      client_id_issued_at: now,
      ...(clientSecret ? {
        client_secret: clientSecret,
        client_secret_expires_at: secretExpiresAt!,
      } : {}),
    }
  }
}

export const clientsStore = new SupabaseClientsStore()
