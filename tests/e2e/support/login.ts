import type { Page } from '@playwright/test'
import { E2E } from './env'

/** Sign in through Dex's password form, starting from RC behind the router; resolves back on RC. */
export async function login(page: Page, user: string, password: string): Promise<void> {
  await page.goto(E2E.baseURL)
  await page.locator('#login').fill(user)
  await page.locator('#password').fill(password)
  await page.locator('#submit-login').click()
  await page.waitForURL(url => url.href.startsWith(E2E.baseURL), { timeout: 30_000 })
}
