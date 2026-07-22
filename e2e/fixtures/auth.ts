import { test as base, Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type AuthFixtures = {
  guidePage: Page
  playerPage: Page
}

export const test = base.extend<AuthFixtures>({
  guidePage: async ({ browser }, use) => {
    const { data } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_PARENT_EMAIL!,
      password: process.env.TEST_PARENT_PASSWORD!,
    })
    const context = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [
          {
            origin: process.env.NEXT_PUBLIC_SUPABASE_URL!,
            localStorage: [
              {
                name: 'supabase.auth.token',
                value: JSON.stringify(data.session),
              },
            ],
          },
        ],
      },
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
  playerPage: async ({ browser }, use) => {
    const { data } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_STUDENT_USERNAME!,
      password: process.env.TEST_STUDENT_PASSWORD!,
    })
    const context = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [
          {
            origin: process.env.NEXT_PUBLIC_SUPABASE_URL!,
            localStorage: [
              {
                name: 'supabase.auth.token',
                value: JSON.stringify(data.session),
              },
            ],
          },
        ],
      },
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect } from '@playwright/test'
