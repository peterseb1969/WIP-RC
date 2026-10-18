import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson, createTemplate } from './support/wip'

// A template value is unique only within its namespace. With the same value in
// two namespaces, the document pages must act on the selected namespace's
// template: a new document, the table view and a CSV import all stay in it. The
// twin namespace's template is created first, so an unscoped lookup by value
// would find it.

test.describe.configure({ mode: 'serial' })

const TEMPLATE = 'E2E_TWIN'

type Tpl = { template_id: string; value: string }
type Doc = { document_id: string; namespace: string; template_id: string; data: Record<string, unknown> }

test.describe('same-named templates in two namespaces', () => {
  // Read lazily: test files are collected before global setup writes the run file.
  let ns = ''
  let twin = ''
  let ownId = ''

  test.beforeAll(async () => {
    ;({ namespace: ns, twin } = run())
    const api = await wipApi()
    for (const prefix of [twin, ns]) {
      await createTemplate(api, {
        value: TEMPLATE,
        label: `E2E Twin (${prefix === ns ? 'own' : 'twin'})`,
        namespace: prefix,
        identity_fields: ['code'],
        fields: [{ name: 'code', label: 'code', type: 'string', mandatory: true }],
      })
    }
    const own = await getJson<{ items: Tpl[] }>(api, `/api/template-store/templates?namespace=${ns}&page_size=100`)
    ownId = own.items.find(t => t.value === TEMPLATE)!.template_id
    await api.dispose()
  })

  const docsIn = async (namespace: string) => {
    const api = await wipApi()
    const r = await getJson<{ items: Doc[] }>(api, `/api/document-store/documents?namespace=${namespace}&template_value=${TEMPLATE}&page_size=100`)
    await api.dispose()
    return r.items
  }

  test('a new document is created in the selected namespace', async ({ page }) => {
    await page.goto(`documents?ns=${ns}&template=${TEMPLATE}`)
    await page.getByRole('link', { name: 'New document' }).click()
    await expect(page.getByText('E2E Twin (own)').first()).toBeVisible()
    await page.getByLabel('code').fill('T-1')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/documents/${TEMPLATE}/(?!new)[^/?]+`))

    const own = await docsIn(ns)
    expect(own.map(d => d.data.code)).toEqual(['T-1'])
    expect(own[0].template_id).toBe(ownId)
    expect(await docsIn(twin)).toEqual([])
  })

  test('the table view reads the selected namespace\'s template', async ({ page }) => {
    await page.goto(`documents?ns=${ns}&template=${TEMPLATE}`)
    await page.getByRole('link', { name: 'Table', exact: true }).click()
    await expect(page.getByRole('cell', { name: 'T-1' })).toBeVisible()
  })

  test('an import by template value resolves in the selected namespace', async ({ page }) => {
    // Set the namespace filter, then open the import with only the value, as a typed URL would.
    await page.goto(`documents?ns=${ns}`)
    await page.goto(`documents/import?template=${TEMPLATE}`)
    await expect(page.getByText('E2E Twin (own)')).toBeVisible()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'twins.csv', mimeType: 'text/csv', buffer: Buffer.from('code\nT-2\n'),
    })
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('button', { name: 'Start Import' }).click()
    await expect(page.getByText('Imported documents (1)')).toBeVisible({ timeout: 30_000 })

    const own = await docsIn(ns)
    expect(own.map(d => d.data.code).sort()).toEqual(['T-1', 'T-2'])
    expect(own.every(d => d.template_id === ownId)).toBe(true)
    expect(await docsIn(twin)).toEqual([])
  })
})
