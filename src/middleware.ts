import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const APEX_HOST = 'lessonhollow.com'

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''

  // Redirect www to apex with 301 (permanent)
  if (host === `www.${APEX_HOST}` || host.startsWith(`www.${APEX_HOST}:`)) {
    const url = request.nextUrl.clone()
    url.host = APEX_HOST
    url.port = ''
    return NextResponse.redirect(url, 301)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/mcp|oauth/token|oauth/register|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|csv)$).*)',
  ],
}
