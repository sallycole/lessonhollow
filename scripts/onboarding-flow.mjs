#!/usr/bin/env node
/**
 * Signs up a fresh test account and walks the full onboarding flow,
 * capturing screenshots at each mid-state. Use this to verify Phase 3
 * (onboarding) migrations end-to-end.
 *
 * Convention:
 *   email:    test<N>@lessonhollow.com   (bump N each run)
 *   username: testuser<N>
 *   password: hermes88                   (8 chars — hermes + 88 to satisfy minLength)
 *
 * Run: node --env-file=.env.local scripts/onboarding-flow.mjs --n 4
 */

import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { parseArgs } from 'node:util'

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000'
const OUT_DIR = '/tmp/lh-screenshots'
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? '/etc/profiles/per-user/sal/bin/chromium'
const VIEWPORT = { width: 1440, height: 900 }
const PASSWORD = 'hermes88'

const { values: args } = parseArgs({
  options: {
    n: { type: 'string', default: '4' },
    student: { type: 'string', default: '1' },
  },
})

const N = args.n
const EMAIL = `test${N}@lessonhollow.com`
const USERNAME = `testuser${N}`
const FIRST_NAME = `Test${N}`
const LAST_NAME = 'Hermes'

async function snap(page, name) {
  const path = `${OUT_DIR}/onboarding-${name}.png`
  await page.screenshot({ path, fullPage: true })
  console.log(`  ✓ ${name}`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH })
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'light' })
  const page = await context.newPage()

  console.log(`Onboarding flow: email=${EMAIL} username=${USERNAME}`)

  // ----- Step 1: /onboarding/account -----
  await page.goto(`${BASE_URL}/onboarding/account`, { waitUntil: 'networkidle' })
  await page.fill('input[name="firstName"]', FIRST_NAME)
  await page.fill('input[name="lastName"]', LAST_NAME)
  await page.fill('input[name="username"]', USERNAME)
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await snap(page, 'account-filled')

  // Submit and wait for redirect to /onboarding/players
  await Promise.all([
    page.waitForURL((u) => u.pathname.startsWith('/onboarding/players'), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ])

  // ----- Step 2: /onboarding/players (ask state) -----
  await page.waitForLoadState('networkidle')
  await snap(page, 'players-ask')

  // Choose "I'm setting up additional Players" — find by text
  await page.getByRole('button', { name: /setting up additional Players/i }).click()
  await page.waitForLoadState('networkidle')
  await snap(page, 'players-count')

  // Bump count to 2
  await page.getByRole('button', { name: 'Increase count' }).click()
  await page.getByRole('button', { name: 'Increase count' }).click()
  await snap(page, 'players-count-2')

  // Click Continue to advance to the form state
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForLoadState('networkidle')
  await snap(page, 'players-form')

  // Skip to curriculum step (use the "skip" link rather than filling 2 players)
  await page.getByRole('button', { name: /set up additional players later/i }).click()

  // ----- Step 3: /onboarding/curriculum (choose state) -----
  await page.waitForURL((u) => u.pathname.startsWith('/onboarding/curriculum'), { timeout: 15000 })
  await page.waitForLoadState('networkidle')
  await snap(page, 'curriculum-choose')

  // If "Browse curriculums" exists, click it
  const browseBtn = page.getByRole('button', { name: 'Browse curriculums' })
  if (await browseBtn.count()) {
    await browseBtn.click()
    await page.waitForLoadState('networkidle')
    await snap(page, 'curriculum-browse')
  }

  await browser.close()
  console.log(`\nDone. Screenshots in ${OUT_DIR}/onboarding-*.png`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
