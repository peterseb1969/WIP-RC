import { test, expect, type Page } from '@playwright/test'

// Every sidebar page loads: it renders its heading, shows no error state, and
// logs no uncaught exceptions or console errors. This catches most
// "a lib bump broke a page" regressions.

const PAGES: Array<{ path: string; heading: RegExp }> = [
  { path: '', heading: /Dashboard/ },
  { path: 'namespaces', heading: /Namespaces/ },
  { path: 'terminologies', heading: /Terminologies/ },
  { path: 'templates', heading: /Templates/ },
  { path: 'documents', heading: /Documents/ },
  { path: 'files', heading: /Files/ },
  { path: 'registry', heading: /Registry/ },
  { path: 'postgres', heading: /PostgreSQL/ },
  { path: 'mongodb', heading: /MongoDB/ },
  { path: 'nats', heading: /NATS/ },
  { path: 'integrity', heading: /Integrity/ },
  { path: 'audit-explorer', heading: /Audit Explorer/ },
  { path: 'activity', heading: /Activity/ },
  { path: 'api-keys', heading: /API Keys/ },
  { path: 'backup', heading: /Backup/ },
  { path: 'query', heading: /Query/ },
]

/** Collect uncaught page errors and console errors while a page is used. */
function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`))
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  return errors
}

test.describe('smoke', () => {
  test('health and app-config endpoints answer', async ({ request }) => {
    for (const path of ['health', 'api/health', 'api/app-config']) {
      const r = await request.get(path)
      expect(r.status(), path).toBe(200)
    }
  })

  for (const { path, heading } of PAGES) {
    test(`page /${path} loads without errors`, async ({ page }) => {
      const errors = watchErrors(page)
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('alert')).toHaveCount(0)
      expect(errors).toEqual([])
    })
  }
})
