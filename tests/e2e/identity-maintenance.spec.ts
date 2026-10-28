import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, createTemplate, createDocuments } from './support/wip'

// Identity Maintenance against the live document-store: a preview (dry run) of
// this run's disposable namespace. Freshly written documents already carry
// current identity hashes, so the preview scans them and finds nothing to
// change, which also exercises the gate (the e2e user must be an admin) and
// leaves Apply unavailable. The apply path needs documents with a legacy-format
// hash, which cannot be created through the API; it is covered by the page's
// component test.

const TEMPLATE = 'E2E_REHASH'

test.describe('identity maintenance', () => {
  let ns = ''

  test.beforeAll(async () => {
    ns = run().namespace
    const api = await wipApi()
    await createTemplate(api, {
      value: TEMPLATE,
      label: 'E2E Rehash',
      namespace: ns,
      identity_fields: ['name'],
      fields: [{ name: 'name', label: 'name', type: 'string', mandatory: true }],
    })
    await createDocuments(api, ns, TEMPLATE, [{ name: 'one' }, { name: 'two' }])
    await api.dispose()
  })

  test('previews a namespace without writing and keeps Apply unavailable', async ({ page }) => {
    await page.goto('')
    await page.getByRole('link', { name: 'Identity Maintenance' }).click()
    await expect(page.getByRole('heading', { name: 'Identity Maintenance' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Preview/ })).toBeDisabled()

    await page.getByLabel('Namespace *', { exact: true }).selectOption(ns)
    const template = page.getByLabel(`E2E Rehash (${TEMPLATE})`)
    await expect(template).toBeVisible()
    await template.check()
    await page.getByRole('button', { name: /^Preview/ }).click()

    await expect(page.getByText('Would change', { exact: true })).toBeVisible()
    await expect(page.getByText('Nothing has been written.')).toBeVisible()
    const scanned = page.getByText('Scanned', { exact: true }).locator('..')
    await expect(scanned).toContainText('2')
    const changed = page.getByText('Would change', { exact: true }).locator('..')
    await expect(changed).toContainText('0')

    await expect(page.getByRole('button', { name: /^Apply to/ })).toBeDisabled()
    await expect(page.getByText('The preview found nothing to change.')).toBeVisible()
  })
})
