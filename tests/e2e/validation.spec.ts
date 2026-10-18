import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson, createTemplate, createDocuments } from './support/wip'

// The document form's failure paths, in this run's namespace: a missing
// mandatory field is caught before saving, a value the platform rejects
// (a pattern) comes back as a visible error, and an edit that lost a race
// with another writer is refused as a conflict with a way to reload. In each
// case nothing is written.

test.describe.configure({ mode: 'serial' })

const TEMPLATE = 'E2E_VALID'

type Doc = { document_id: string; version: number; data: Record<string, unknown> }

test.describe('form validation', () => {
  let ns = ''

  test.beforeAll(async () => {
    ns = run().namespace
    const api = await wipApi()
    await createTemplate(api, {
      value: TEMPLATE,
      label: 'E2E Validated',
      namespace: ns,
      identity_fields: ['code'],
      fields: [
        { name: 'code', label: 'code', type: 'string', mandatory: true, validation: { pattern: '^[A-Z]{2}-[0-9]+$' } },
        { name: 'title', label: 'title', type: 'string', mandatory: true },
        { name: 'note', label: 'note', type: 'string' },
      ],
    })
    await api.dispose()
  })

  const docs = async () => {
    const api = await wipApi()
    const r = await getJson<{ items: Doc[] }>(api, `/api/document-store/documents?namespace=${ns}&template_value=${TEMPLATE}&page_size=100`)
    await api.dispose()
    return r.items
  }

  const openNew = async (page: import('@playwright/test').Page) => {
    await page.goto(`documents?ns=${ns}&template=${TEMPLATE}`)
    await page.getByRole('link', { name: 'New document' }).click()
    await expect(page.getByLabel('code')).toBeVisible()
  }

  test('a missing mandatory field is caught before saving', async ({ page }) => {
    await openNew(page)
    await page.getByLabel('code').fill('AB-1')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Please fix the highlighted errors')
    await expect(page).toHaveURL(/\/new/)
    expect(await docs()).toEqual([])
  })

  test('a value the platform rejects is shown, not swallowed', async ({ page }) => {
    await openNew(page)
    await page.getByLabel('code').fill('not a code')
    await page.getByLabel('title').fill('Pattern check')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(/code|pattern/i)
    await expect(page).toHaveURL(/\/new/)
    expect(await docs()).toEqual([])
  })

  test('an edit that lost a race is refused as a conflict', async ({ page }) => {
    const api = await wipApi()
    const [id] = await createDocuments(api, ns, TEMPLATE, [{ code: 'AB-2', title: 'Original' }])
    await page.goto(`documents/${TEMPLATE}/${id}/edit`)
    await expect(page.getByLabel('title')).toHaveValue('Original')

    // Another writer saves version 2 while the form still holds version 1.
    const patched = await api.fetch('/api/document-store/documents', {
      method: 'PATCH', data: [{ document_id: id, patch: { note: 'written elsewhere' } }],
    })
    expect(patched.ok()).toBe(true)

    await page.getByLabel('title').fill('Mine')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('changed by someone else after you opened it')
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()

    const doc = await getJson<Doc>(api, `/api/document-store/documents/${id}`)
    await api.dispose()
    expect(doc.version).toBe(2)
    expect(doc.data).toMatchObject({ title: 'Original', note: 'written elsewhere' })
  })
})
