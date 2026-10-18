import { test, expect } from '@playwright/test'

// Infrastructure pages against the live services: the MongoDB query pad runs a
// read-only find and refuses server-side JavaScript; the NATS page connects as
// the console's own NATS user. Self-contained: reads platform data only.

test.describe('infrastructure pages', () => {
  test('MongoDB query pad finds documents and refuses $where', async ({ page }) => {
    await page.goto('mongodb')
    await page.getByRole('button', { name: /wip_def_store/ }).click()
    await page.getByRole('button', { name: /^terminologies/ }).click()
    await page.getByRole('button', { name: 'Query', exact: true }).click()

    const filter = page.getByRole('textbox', { name: 'Filter (Extended JSON)' })
    await filter.fill('{"status": "active"}')
    await page.getByRole('button', { name: 'Find', exact: true }).click()
    await expect(page.getByText(/of [\d,]+ matching/)).toBeVisible()

    await filter.fill('{"$where": "true"}')
    await page.getByRole('button', { name: 'Find', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('$where runs JavaScript in the database and is not allowed')
  })

  test('NATS page connects as the console identity', async ({ page }) => {
    await page.goto('nats')
    await expect(page.getByText('Connected', { exact: true })).toBeVisible()
    await expect(page.getByText('User react-console')).toBeVisible()
    await expect(page.getByText('WIP_EVENTS').first()).toBeVisible()
  })
})
