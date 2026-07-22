import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

type AuthSuccess = { user: User; response?: never }
type AuthFailure = { user?: never; response: NextResponse }

/**
 * Validate the caller's Supabase session for API routes.
 * Returns the authenticated user, or a 401 NextResponse with WWW-Authenticate header.
 *
 * Usage:
 *   const { user, response } = await requireAuth()
 *   if (response) return response
 */
export async function requireAuth(): Promise<AuthSuccess | AuthFailure> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        response: NextResponse.json(
          { error: 'Unauthorized' },
          {
            status: 401,
            headers: { 'WWW-Authenticate': 'Bearer' },
          }
        ),
      }
    }

    return { user }
  } catch (err) {
    console.error('[requireAuth] Error:', err)
    return {
      response: NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer' },
        }
      ),
    }
  }
}
