import { createHash, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { db } from './db'

export type McpAuthResult = {
  valid: boolean
  userId?: string
  authType?: 'api_key' | 'jwt' | 'oauth'
  error?: string
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function generateApiKey(): {
  fullKey: string
  keyHash: string
  keyPrefix: string
} {
  const randomHex = randomBytes(32).toString('hex')
  const fullKey = `gt3p_${randomHex}`
  const keyHash = hashApiKey(fullKey)
  const keyPrefix = fullKey.substring(0, 9)
  return { fullKey, keyHash, keyPrefix }
}

export async function authenticateMcpRequest(
  authHeader: string | null
): Promise<McpAuthResult> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header' }
  }

  const token = authHeader.slice(7)

  try {
    if (token.startsWith('gt3p_')) {
      // API key flow: hash and look up
      const keyHash = hashApiKey(token)
      const { data: keyRecord, error } = await db.getActiveKeyByHash(keyHash)

      if (error || !keyRecord) {
        return { valid: false, error: 'Invalid or revoked API key' }
      }

      // Update last_used_at (fire-and-forget)
      db.updateKeyLastUsed(keyRecord.id).catch(() => {})

      return { valid: true, userId: keyRecord.guide_id, authType: 'api_key' }
    } else {
      // Try OAuth token first, fall back to Supabase JWT
      try {
        const { verifyAccessToken } = await import('@/lib/oauth/provider')
        const authInfo = await verifyAccessToken(token)
        return { valid: true, userId: authInfo.userId, authType: 'oauth' }
      } catch {
        // Not a valid OAuth token — fall through to JWT
      }

      // Supabase JWT flow
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token)

      if (error || !user) {
        return { valid: false, error: 'Invalid JWT token' }
      }

      return { valid: true, userId: user.id, authType: 'jwt' }
    }
  } catch {
    return { valid: false, error: 'Authentication failed' }
  }
}
