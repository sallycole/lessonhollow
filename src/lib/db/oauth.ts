import type { SupabaseClient } from '@supabase/supabase-js'

export function createOAuthDb(getClient: () => SupabaseClient) {
  return {
    async createOAuthClient(data: {
      client_id: string
      client_secret_hash?: string | null
      client_id_issued_at: number
      client_secret_expires_at?: number | null
      redirect_uris: string[]
      client_name?: string | null
      client_uri?: string | null
      logo_uri?: string | null
      token_endpoint_auth_method?: string
      grant_types?: string[] | null
      response_types?: string[] | null
      scope?: string | null
    }) {
      return getClient()
        .from('oauth_clients')
        .insert({
          ...data,
          redirect_uris: JSON.stringify(data.redirect_uris),
          grant_types: data.grant_types ? JSON.stringify(data.grant_types) : null,
          response_types: data.response_types ? JSON.stringify(data.response_types) : null,
        })
        .select()
        .single()
    },

    async getOAuthClient(clientId: string) {
      return getClient()
        .from('oauth_clients')
        .select('*')
        .eq('client_id', clientId)
        .single()
    },

    async createAuthorizationCode(data: {
      code_hash: string
      client_id: string
      user_id: string
      redirect_uri: string
      code_challenge: string
      scopes?: string[] | null
      state?: string | null
      resource?: string | null
      expires_at: string
    }) {
      return getClient()
        .from('oauth_authorization_codes')
        .insert(data)
        .select()
        .single()
    },

    async getAuthorizationCode(codeHash: string) {
      return getClient()
        .from('oauth_authorization_codes')
        .select('*')
        .eq('code_hash', codeHash)
        .single()
    },

    async markAuthorizationCodeUsed(codeHash: string) {
      return getClient()
        .from('oauth_authorization_codes')
        .update({ used: true })
        .eq('code_hash', codeHash)
        .eq('used', false)
        .select()
        .single()
    },

    async createOAuthToken(data: {
      token_hash: string
      client_id: string
      user_id: string
      scopes?: string[] | null
      token_type: 'access' | 'refresh'
      expires_at: string
      resource?: string | null
    }) {
      return getClient()
        .from('oauth_tokens')
        .insert(data)
        .select()
        .single()
    },

    async getOAuthToken(tokenHash: string) {
      return getClient()
        .from('oauth_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
        .single()
    },

    async revokeOAuthToken(tokenHash: string) {
      return getClient()
        .from('oauth_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
    },
  }
}
