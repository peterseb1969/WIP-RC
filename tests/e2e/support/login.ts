import type { Page } from '@playwright/test'
import { E2E } from './env'

/** Sign in through Dex's password form, starting from RC behind the router; resolves back on RC. */
export async function login(page: Page, user: string, password: string): Promise<void> {
  await page.goto(E2E.baseURL)
  await page.locator('#login').fill(user)
  await page.locator('#password').fill(password)
  await page.locator('#submit-login').click()
  // Back on RC's path, on whichever origin serves it. On an install that
  // serves each app on its own origin, WIP's /apps/rc/ answers 301 to
  // https://rc.<host>/apps/rc/, and the suite must be pointed there.
  const rcPath = new URL(E2E.baseURL).pathname
  await page.waitForURL(url => url.pathname.startsWith(rcPath), { timeout: 30_000 })
  const landed = new URL(page.url()).origin
  if (landed !== new URL(E2E.baseURL).origin) {
    throw new Error(`RC is served on its own origin here (${landed}). Run the suite with E2E_BASE_URL=${landed}${rcPath}`)
  }
}
