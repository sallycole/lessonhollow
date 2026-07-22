import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Auth pages that redirect authenticated users away
const AUTH_PAGES = ['/login', '/signup', '/forgot-password', '/player-login']

// API paths that skip auth checks
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/mcp', '/api/actions/', '/api/payments/webhook', '/oauth/token', '/oauth/register']

// Routes that require authentication
const PROTECTED_PREFIXES = ['/dashboard', '/players', '/account', '/credits', '/publish', '/curriculums', '/today', '/log', '/rewards', '/plan', '/progress', '/enrollments']

const MOBILE_UA_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i

export async function updateSession(request: NextRequest) {
  // Inject x-pathname so server-component layouts can read the current route via headers().
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('[middleware] ENV VARS MISSING — skipping auth check', {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Set device-class cookie from User-Agent (readable by server components and client)
  const ua = request.headers.get('user-agent') ?? ''
  supabaseResponse.cookies.set('device-class', MOBILE_UA_RE.test(ua) ? 'mobile' : 'desktop', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  })

  // Refresh the session (also attempts token refresh) — important for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  // Clean up stale masquerade cookie when no authenticated user
  if (!user && request.cookies.get('masquerade')?.value) {
    supabaseResponse.cookies.delete('masquerade')
  }

  const pathname = request.nextUrl.pathname

  // OAuth callback — always pass through
  if (pathname.startsWith('/auth/callback')) {
    return supabaseResponse
  }

  // API route auth checks
  if (pathname.startsWith('/api/')) {
    const isPublicApi = PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    console.log('[middleware] API route:', pathname, 'isPublic:', isPublicApi, 'user:', !!user)
    if (!isPublicApi && !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      )
    }
    return supabaseResponse
  }

  const role = user?.user_metadata?.role as string | undefined

  // Onboarding routes
  if (pathname.startsWith('/onboarding')) {
    // Onboarding is only "in progress" for new signups where the flag is
    // explicitly false. Existing users (flag undefined) and finished users
    // (flag true) are treated as already onboarded.
    const onboardingInProgress = user?.user_metadata?.onboarding_completed === false

    // Already onboarded — send to dashboard
    if (user && !onboardingInProgress) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // /onboarding/account is accessible without auth
    if (pathname === '/onboarding/account' || pathname === '/onboarding') {
      return supabaseResponse
    }

    // All other onboarding steps require auth
    if (!user) {
      return NextResponse.redirect(new URL('/onboarding/account', request.url))
    }

    return supabaseResponse
  }

  // Auth pages — redirect authenticated users to their dashboard
  if (AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(page + '/'))) {
    if (user) {
      if (!role) {
        // User without role — send to onboarding
        return NextResponse.redirect(new URL('/onboarding/account', request.url))
      }
      // Let guides access /player-login so they can switch to a player session
      if (role !== 'player' && pathname === '/player-login') {
        return supabaseResponse
      }
      const destination = role === 'player' ? '/today' : '/dashboard'
      return NextResponse.redirect(new URL(destination, request.url))
    }
    return supabaseResponse
  }

  // Protected routes — require authentication
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
  if (isProtected) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      const redirectTo = request.nextUrl.search
        ? `${pathname}${request.nextUrl.search}`
        : pathname
      loginUrl.searchParams.set('redirectTo', redirectTo)
      return NextResponse.redirect(loginUrl)
    }

    // No role — redirect to onboarding
    if (!role) {
      return NextResponse.redirect(new URL('/onboarding/account', request.url))
    }

    // Guide who is mid-signup hitting /dashboard — redirect to onboarding.
    // Only triggers when the flag is explicitly false (set during fresh signup).
    // Existing users (flag undefined) are not redirected.
    if (role === 'guide' && pathname === '/dashboard' && user.user_metadata?.onboarding_completed === false) {
      return NextResponse.redirect(new URL('/onboarding/players', request.url))
    }

    // Player (or masquerading guide) accessing guide-only routes → redirect to /today
    // Exception: masquerading guides can still access /credits (linked from /rewards)
    const isMasquerading = request.cookies.get('masquerade')?.value
    const guideOnlyRoute =
      pathname === '/dashboard' ||
      pathname.startsWith('/players') ||
      pathname.startsWith('/account') ||
      pathname.startsWith('/credits')
    if (guideOnlyRoute) {
      if (role === 'player') {
        return NextResponse.redirect(new URL('/today', request.url))
      }
      if (isMasquerading && !pathname.startsWith('/credits')) {
        return NextResponse.redirect(new URL('/today', request.url))
      }
    }

    return supabaseResponse
  }

  return supabaseResponse
}
