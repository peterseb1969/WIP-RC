import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson, createTemplate, createDocuments, templateId } from './support/wip'

// Template versioning through the UI, in this run's namespace. A schema change
// on a template with documents mints version 2 and leaves version 1 active
// (both accept documents until one is deactivated); existing documents stay on
// version 1 and a new one gets version 2; a version can be deactivated and
// reactivated on its own; identity fields are locked once a template exists.

test.describe.configure({ mode: 'serial' })

const TEMPLATE = 'E2E_VER'

type Version = { version: number; status: string }
type Doc = { data: Record<string, unknown>; template_version: number }

test.describe('template versioning', () => {
  let ns = ''
  let tid = ''

  const versions = async () => {
    const api = await wipApi()
    const r = await getJson<Version[] | { items: Version[] }>(api, `/api/template-store/templates/by-value/${TEMPLATE}/versions?namespace=${ns}`)
    await api.dispose()
    return (Array.isArray(r) ? r : r.items).map(v => [v.version, v.status]).sort()
  }

  test.beforeAll(async () => {
    ns = run().namespace
    const api = await wipApi()
    await createTemplate(api, {
      value: TEMPLATE,
      label: 'E2E Versioned',
      namespace: ns,
      identity_fields: ['code'],
      fields: [
        { name: 'code', label: 'code', type: 'string', mandatory: true },
        { name: 'title', label: 'title', type: 'string' },
      ],
    })
    tid = await templateId(api, ns, TEMPLATE)
    await createDocuments(api, ns, TEMPLATE, [{ code: 'V-1', title: 'one' }, { code: 'V-2', title: 'two' }])
    await api.dispose()
  })

  test('a schema change mints version 2 and leaves version 1 active', async ({ page }) => {
    await page.goto(`templates/${tid}`)
    await page.getByRole('link', { name: 'Edit', exact: true }).click()
    await expect(page.getByText('2 documents use this template. Schema changes will create version 2', { exact: false })).toBeVisible()

    const quickAdd = page.locator('form', { has: page.getByRole('button', { name: 'Add', exact: true }) })
    await quickAdd.getByPlaceholder('field_name').fill('note')
    await quickAdd.getByRole('button', { name: 'Add', exact: true }).click()
    const close = page.getByRole('button', { name: 'Close field settings' })
    if (await close.isVisible()) await close.click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // The save reports the version it minted before moving on.
    await page.getByRole('button', { name: 'Continue to template' }).click()
    await expect(page).toHaveURL(new RegExp(`/templates/${tid}$`))
    await expect(page.getByRole('link', { name: 'v2', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'v1', exact: true })).toBeVisible()

    expect(await versions()).toEqual([[1, 'active'], [2, 'active']])
  })

  test('existing documents stay on version 1; a new one gets version 2', async ({ page }) => {
    await page.goto(`documents?ns=${ns}&template=${TEMPLATE}`)
    await page.getByRole('link', { name: 'New document' }).click()
    await page.getByLabel('code').fill('V-3')
    await page.getByLabel('note').fill('added in v2')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/documents/${TEMPLATE}/(?!new)[^/?]+`))

    const api = await wipApi()
    const docs = await getJson<{ items: Doc[] }>(api, `/api/document-store/documents?namespace=${ns}&template_value=${TEMPLATE}&page_size=100`)
    await api.dispose()
    const byCode = Object.fromEntries(docs.items.map(d => [d.data.code, d.template_version]))
    expect(byCode).toEqual({ 'V-1': 1, 'V-2': 1, 'V-3': 2 })
  })

  test('deactivate and reactivate version 1 on its own', async ({ page }) => {
    await page.goto(`templates/${tid}?v=1`)
    await page.getByRole('button', { name: 'Deactivate', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm Deactivate v1' }).click()
    // Deactivating returns to the template list.
    await expect(page).toHaveURL(/\/templates$/)
    expect(await versions()).toEqual([[1, 'inactive'], [2, 'active']])

    await page.goto(`templates/${tid}?v=1`)
    await expect(page.getByRole('link', { name: 'v1 (inactive)' })).toBeVisible()
    await page.getByRole('button', { name: 'Reactivate' }).click()
    await expect(page.getByRole('link', { name: 'v1', exact: true })).toBeVisible()
    expect(await versions()).toEqual([[1, 'active'], [2, 'active']])
  })

  test('identity fields are locked when editing', async ({ page }) => {
    await page.goto(`templates/${tid}/edit`)
    const identity = page.locator('div').filter({ has: page.getByRole('heading', { name: /Identity Fields/ }) }).last()
    await expect(identity.getByText('fixed after creation')).toBeVisible()
    await expect(identity.getByRole('button', { name: 'code', exact: true })).toBeDisabled()
    await expect(identity.getByRole('button', { name: 'code', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(identity.getByRole('button', { name: 'title', exact: true })).toBeDisabled()
  })
})
