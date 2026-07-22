#!/usr/bin/env node
/**
 * Lesson Hollow screenshot tool for the Pico migration.
 *
 * Captures PNGs of routes at desktop + mobile widths × light + dark themes,
 * using saved auth sessions for guide and player views. Output lands in
 * /tmp/lh-screenshots/ so it's outside the repo.
 *
 * Run:
 *   npm run screenshot                       # all routes, all variants
 *   npm run screenshot -- --route today      # one route
 *   npm run screenshot -- --route today,plan --viewport desktop --theme dark
 *
 * Requires (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   TEST_PARENT_EMAIL, TEST_PARENT_PASSWORD               (for guide-auth routes)
 *   TEST_STUDENT_USERNAME_<N>, TEST_STUDENT_PASSWORD_<N>  (one or more numbered student accounts)
 *   SCREENSHOT_BASE_URL                                    (optional, default http://localhost:3000)
 *
 * Pick which student to use via --student N (default 1).
 */

import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { parseArgs } from 'node:util'

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000'
const OUT_DIR = '/tmp/lh-screenshots'
// Playwright's downloaded Chromium binary depends on system libs (libnspr4.so
// etc.) that aren't in the NixOS environment. Point at the system-installed
// chromium instead. Override via CHROMIUM_PATH env var if needed.
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? '/etc/profiles/per-user/sal/bin/chromium'

/** @type {Array<{name: string, path: string, auth: 'public' | 'guide' | 'player', waitFor?: string}>} */
const ROUTES = [
  // Public
  { name: 'home', path: '/', auth: 'public' },
  { name: 'pricing', path: '/pricing', auth: 'public' },
  { name: 'blog', path: '/blog', auth: 'public' },
  { name: 'blog-post', path: '/blog/welcome-to-lesson-hollow', auth: 'public' },
  { name: 'privacy', path: '/privacy', auth: 'public' },
  { name: 'terms', path: '/terms', auth: 'public' },
  { name: 'discover', path: '/discover', auth: 'public' },
  { name: 'discover-detail', path: '/discover/introduction-to-personal-curriculum', auth: 'public' },
  { name: 'help', path: '/help', auth: 'public' },
  { name: 'tools', path: '/tools/staged-day-generator', auth: 'public' },

  // Auth pages
  { name: 'login', path: '/login', auth: 'public' },
  { name: 'signup', path: '/signup', auth: 'public' },
  { name: 'forgot-password', path: '/forgot-password', auth: 'public' },
  { name: 'onboarding-account', path: '/onboarding/account', auth: 'public' },
  {
    name: 'oauth-consent',
    path: '/oauth/authorize?client_id=a3204572-8a51-44aa-a73c-8919f38976bd&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth-test-callback&response_type=code&code_challenge=bLQIUOXpawGnQahxt71owTq_OCs-dQLQiRJC87d73e8&code_challenge_method=S256&state=test',
    auth: 'guide',
  },

  // Guide
  { name: 'dashboard', path: '/dashboard', auth: 'guide' },
  { name: 'players', path: '/players', auth: 'guide' },
  { name: 'account', path: '/account', auth: 'guide' },
  { name: 'credits', path: '/credits', auth: 'guide' },

  // Player
  { name: 'today', path: '/today', auth: 'player' },
  { name: 'plan', path: '/plan', auth: 'player' },
  { name: 'log', path: '/log', auth: 'player' },
  { name: 'enrollments', path: '/enrollments', auth: 'player' },
  { name: 'curriculums', path: '/curriculums', auth: 'player' },
  { name: 'progress', path: '/progress', auth: 'player' },
  { name: 'rewards', path: '/rewards', auth: 'player' },
]

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

const THEMES = ['light', 'dark']

// ---- CLI ----
const { values: args } = parseArgs({
  options: {
    route: { type: 'string' },
    viewport: { type: 'string' },
    theme: { type: 'string' },
    student: { type: 'string', default: '1' },
    fullPage: { type: 'boolean', default: true },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
})

if (args.help) {
  console.log(`Usage: npm run screenshot -- [--route a,b,c] [--viewport desktop|mobile] [--theme light|dark]`)
  process.exit(0)
}

const filterRoutes = args.route ? args.route.split(',').map((s) => s.trim()) : null
const filterViewports = args.viewport ? [args.viewport] : Object.keys(VIEWPORTS)
const filterThemes = args.theme ? [args.theme] : THEMES

const selectedRoutes = filterRoutes
  ? ROUTES.filter((r) => filterRoutes.includes(r.name))
  : ROUTES

if (selectedRoutes.length === 0) {
  console.error(`No routes matched. Available: ${ROUTES.map((r) => r.name).join(', ')}`)
  process.exit(1)
}

// ---- Auth helpers ----
function envOrDie(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing ${name} in environment. Add it to .env.local.`)
    process.exit(1)
  }
  return v
}

/**
 * Log in via the actual UI form so the browser collects the auth cookies
 * that @supabase/ssr expects. Returns a storageState object that can be
 * reused for subsequent contexts to skip re-login.
 */
async function loginAndCaptureStorage(browser, role) {
  if (role === 'public') return undefined
  const context = await browser.newContext()
  const page = await context.newPage()

  // Unified login form at /login accepts either guide email or player username
  // in the `identifier` field. The server action figures out which.
  const identifier =
    role === 'guide'
      ? envOrDie('TEST_PARENT_EMAIL')
      : envOrDie(`TEST_STUDENT_USERNAME_${args.student}`)
  const password =
    role === 'guide'
      ? envOrDie('TEST_PARENT_PASSWORD')
      : envOrDie(`TEST_STUDENT_PASSWORD_${args.student}`)

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.fill('input[name="identifier"]', identifier)
  await page.fill('input[name="password"]', password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45000 }).catch(async () => {
      const body = await page.locator('body').innerText()
      throw new Error(`${role} login did not navigate. Current URL: ${page.url()}. Body preview: ${body.slice(0, 300)}`)
    }),
    // Scope to <main> — the footer's feedback form also has a submit button.
    page.click('main button[type="submit"]'),
  ])

  const storageState = await context.storageState()
  await context.close()
  return storageState
}

// ---- Capture loop ----
async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH })
  console.log(`Screenshotting ${selectedRoutes.length} routes × ${filterViewports.length} viewports × ${filterThemes.length} themes`)
  console.log(`Browser: ${CHROMIUM_PATH}`)
  console.log(`Output: ${OUT_DIR}`)

  // Log in once per role and cache the resulting storage state (cookies)
  const storageByRole = {}
  for (const role of new Set(selectedRoutes.map((r) => r.auth))) {
    if (role === 'public') continue
    console.log(`Logging in as ${role}…`)
    storageByRole[role] = await loginAndCaptureStorage(browser, role)
  }

  let captured = 0
  let failed = 0

  for (const route of selectedRoutes) {
    const storage = storageByRole[route.auth]

    for (const vp of filterViewports) {
      const viewport = VIEWPORTS[vp]
      if (!viewport) {
        console.error(`Unknown viewport ${vp}`)
        continue
      }

      for (const theme of filterThemes) {
        const filename = `${OUT_DIR}/${route.name}-${vp}-${theme}.png`
        const context = await browser.newContext({
          viewport,
          storageState: storage,
          colorScheme: theme,
        })
        const page = await context.newPage()
        // Pre-set next-themes localStorage so the override applies before paint.
        await page.addInitScript((t) => {
          localStorage.setItem('theme', t)
        }, theme)

        try {
          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 20000 })
          if (route.waitFor) await page.waitForSelector(route.waitFor, { timeout: 5000 })
          await page.screenshot({ path: filename, fullPage: args.fullPage })
          captured += 1
          console.log(`  ✓ ${route.name} ${vp} ${theme}`)
        } catch (err) {
          failed += 1
          console.log(`  ✗ ${route.name} ${vp} ${theme} — ${err.message.split('\n')[0]}`)
        } finally {
          await context.close()
        }
      }
    }
  }

  await browser.close()
  console.log(`\nDone. ${captured} captured, ${failed} failed.`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
