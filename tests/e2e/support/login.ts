import type { Page } from '@playwright/test'
import { E2E } from './env'

/** Sign in through Dex's password form, starting from RC; resolves back on RC's origin. */
export async function login(page: Page, user: string, password: string): Promise<void> {
  await page.goto(E2E.baseURL)
  await page.locator('#login').fill(user)
  await page.locator('#password').fill(password)
  await page.locator('#submit-login').click()
  // RC is at the root of its own origin, so its path is '/' and says nothing:
  // Dex's and the gateway's pages are under '/' too. Wait for RC's origin.
  const rcOrigin = new URL(E2E.baseURL).origin
  await page.waitForURL(url => url.origin === rcOrigin, { timeout: 30_000 })
}
