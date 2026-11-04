import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { wipApi, getJson } from './support/wip'

// The Registry's auth surfaces RC manages: the system backup and restore,
// orphaned grants and app attachments. Nothing here changes the install's
// auth state: the restore is only ever a dry run, and the one attachment
// written is a fixed probe name, reused by every run and left inactive
// (attachment records are never hard-deleted).

const PROBE = 'rc-e2e-probe'

test.describe('system auth state', () => {
  test.afterAll(async () => {
    const api = await wipApi()
    await api.post('/api/registry/attachments/deactivate', { data: [{ name: PROBE }] })
    await api.dispose()
  })

  test('download a system backup, upload it, and dry-run a restore', async ({ page }) => {
    await page.goto('backup')
    await page.getByRole('button', { name: /System/ }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download system backup' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^wip-system-backup-.+\.json$/)
    await expect(page.getByRole('status')).toContainText('keys')
    const path = await download.path()
    const archive = JSON.parse(readFileSync(path!, 'utf-8')) as { format: string; api_keys: unknown[] }
    expect(archive.format).toBe('wip-system-backup')

    await page.getByLabel('System backup file').setInputFiles(path!)
    await expect(page.getByTestId('archive-summary')).toContainText(`${archive.api_keys.length} keys`)
    await page.getByRole('button', { name: /Dry run/ }).click()
    const report = page.getByTestId('restore-report')
    await expect(report).toBeVisible()
    await expect(report.getByTestId('report-api_keys')).toBeVisible()
    // Its own backup holds nothing to create; the apply is offered but not used here.
    await expect(page.getByRole('button', { name: 'Apply upsert' })).toBeVisible()
  })

  test('a mirror dry run cannot be applied without the typed confirmation', async ({ page }) => {
    const api = await wipApi()
    const res = await api.post('/api/registry/system-backup')
    expect(res.status()).toBe(200)
    const archive = await res.text()
    await api.dispose()

    await page.goto('backup')
    await page.getByRole('button', { name: /System/ }).click()
    await page.getByLabel('System backup file').setInputFiles({ name: 'sys.json', mimeType: 'application/json', buffer: Buffer.from(archive) })
    await page.getByRole('radio', { name: /mirror/ }).check()
    await page.getByRole('button', { name: /Dry run/ }).click()
    await expect(page.getByTestId('restore-report')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Apply mirror' })).toBeDisabled()
  })

  test('the API Keys page lists orphaned grants', async ({ page }) => {
    const api = await wipApi()
    const orphans = await getJson<{ items: unknown[] }>(api, '/api/registry/grants?orphaned=true&page_size=1000')
    await api.dispose()
    await page.goto('api-keys')
    const panel = page.getByTestId('orphaned-grants')
    await expect(panel).toContainText('An orphaned grant gives nothing')
    if (orphans.items.length === 0) await expect(panel).toContainText('No orphaned grants.')
    else await expect(panel.locator('tbody tr')).toHaveCount(orphans.items.length)
  })

  test('attach, edit and deactivate an app; a blocked upstream is refused', async ({ page }) => {
    await page.goto('attachments')
    await page.getByRole('button', { name: /Attach an app/ }).click()
    const form = page.getByRole('group', { name: 'Attach an app' })
    await form.getByLabel('Name *').fill(PROBE)
    await form.getByLabel('Upstream *').fill('http://wip-registry:8001')
    await form.getByRole('button', { name: 'Attach' }).click()
    await expect(form.getByRole('alert')).toContainText("install's own services")

    // A name that resolves nowhere is accepted, with the Registry's warning.
    await form.getByLabel('Upstream *').fill('http://rc-e2e-probe-upstream.invalid:8080')
    await form.getByRole('button', { name: 'Attach' }).click()
    await expect(page.getByRole('status')).toContainText(`/apps/${PROBE}`)

    if (!(await page.getByTestId(`attachment-${PROBE}`).isVisible())) await page.getByLabel('Show inactive').check()
    const row = page.getByTestId(`attachment-${PROBE}`)
    await row.getByRole('button').first().click()
    await row.getByRole('button', { name: 'Edit' }).click()
    await row.getByLabel('Display name').fill('RC E2E probe')
    await row.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status')).toContainText(`Saved /apps/${PROBE}`)
    await expect(row).toContainText('RC E2E probe')

    await row.getByRole('button', { name: 'Deactivate' }).click()
    await row.getByRole('button', { name: 'Yes, deactivate' }).click()
    await expect(page.getByRole('status')).toContainText(`Deactivated /apps/${PROBE}`)
  })
})
