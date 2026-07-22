import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Public pages — always run
// ---------------------------------------------------------------------------

test('homepage loads and shows hero content', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Curio/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('homepage has signup and feature links', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible()
})

test('login page renders with form fields', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: /log in/i })).toBeVisible()
})

test('public discover page loads without auth', async ({ page }) => {
  await page.goto('/discover')
  await expect(page.getByRole('heading', { name: /discover/i })).toBeVisible()
})

test('public pricing page loads without auth', async ({ page }) => {
  await page.goto('/pricing')
  await expect(page.getByRole('heading', { name: /pricing/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// Protected pages — structural rendering
// When Supabase is not configured, middleware passes through and pages
// render in their empty/unauthenticated state. When configured, middleware
// enforces auth redirects.
// ---------------------------------------------------------------------------

test('dashboard page loads', async ({ page }) => {
  await page.goto('/dashboard')
  // Either redirected to login (Supabase configured) or renders dashboard
  const url = page.url()
  if (url.includes('/login')) {
    await expect(page.getByLabel('Email')).toBeVisible()
  } else {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  }
})

test('players page loads', async ({ page }) => {
  await page.goto('/players')
  const url = page.url()
  if (url.includes('/login')) {
    await expect(page.getByLabel('Email')).toBeVisible()
  } else {
    await expect(page.getByRole('heading', { name: /manage players/i })).toBeVisible()
  }
})

// ---------------------------------------------------------------------------
// Full-stack authenticated smoke test — requires TEST_PARENT_EMAIL and
// TEST_PARENT_PASSWORD env vars pointing to a real Supabase test account.
// ---------------------------------------------------------------------------

const hasCredentials = !!(process.env.TEST_PARENT_EMAIL && process.env.TEST_PARENT_PASSWORD)

test.describe('full-stack guide path', () => {
  test.skip(!hasCredentials, 'Skipping: TEST_PARENT_EMAIL / TEST_PARENT_PASSWORD not set')

  test('guide logs in and sees dashboard, players, and today', async ({ page }) => {
    // 1. Log in via the login form (exercises auth + middleware + cookies)
    await page.goto('/login')
    await page.getByLabel('Email').fill(process.env.TEST_PARENT_EMAIL!)
    await page.getByLabel('Password').fill(process.env.TEST_PARENT_PASSWORD!)
    await page.getByRole('button', { name: /log in/i }).click()

    // Should redirect to /dashboard after successful login
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()

    // 2. Navigate to /players — guide sees their player list
    await page.goto('/players')
    await expect(page).toHaveURL(/\/players/)
    await expect(page.getByRole('heading', { name: /manage players/i })).toBeVisible()

    // 3. Navigate to /today — may redirect to dashboard if no masquerade,
    //    which is still a valid integration response
    await page.goto('/today')
    await page.waitForURL(/\/(today|dashboard)/, { timeout: 10_000 })
    const url = page.url()
    if (url.includes('/today')) {
      await expect(page.getByRole('heading', { name: /today/i })).toBeVisible()
    } else {
      await expect(page).toHaveURL(/\/dashboard/)
    }
  })
})
