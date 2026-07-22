import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      const role = user?.user_metadata?.role

      if (!role) {
        // User without a role — redirect to onboarding
        const response = NextResponse.redirect(`${siteUrl}/onboarding/account`)
        response.cookies.delete('masquerade')
        return response
      }

      // Clear masquerade cookie on successful login (REQ-006 safety net)
      const response = NextResponse.redirect(`${siteUrl}${next}`)
      response.cookies.delete('masquerade')
      return response
    }
  }

  // Auth error — redirect to signup with generic error
  return NextResponse.redirect(`${siteUrl}/signup?error=auth`)
}
