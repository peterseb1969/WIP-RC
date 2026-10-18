import { test, expect, type Page } from '@playwright/test'
import { run } from './support/env'
import { wipApi, postJson, createTemplate, createDocuments } from './support/wip'

// Registry identity through the UI, in this run's namespace: add an external-ID
// synonym to a document's entry and check that the registry RESOLVES it (a
// lookup by that key finds the entry), find it with the by-term search, remove
// it, and merge a duplicate entry into the preferred one so the duplicate's ID
// resolves to the preferred entry (Vision: any synonym works like the
// canonical ID).

test.describe.configure({ mode: 'serial' })

const TEMPLATE = 'E2E_PARTY'
const ERP_KEY = { erp_id: 'E2E-SAP-1' }

type Lookup = { status: string; entry_id?: string }

test.describe('registry', () => {
  let ns = ''
  let acme = ''
  let duplicate = ''

  test.beforeAll(async () => {
    ns = run().namespace
    const api = await wipApi()
    await createTemplate(api, {
      value: TEMPLATE,
      label: 'E2E Party',
      namespace: ns,
      identity_fields: ['name'],
      fields: [{ name: 'name', label: 'name', type: 'string', mandatory: true }],
    })
    ;[acme, duplicate] = await createDocuments(api, ns, TEMPLATE, [{ name: 'Acme' }, { name: 'ACME Corp' }])
    await api.dispose()
  })

  const lookupByKey = async (key: Record<string, unknown>): Promise<Lookup> => {
    const api = await wipApi()
    const r = await postJson<{ results: Lookup[] }>(api, '/api/registry/entries/lookup/by-key',
      [{ namespace: ns, entity_type: 'documents', composite_key: key }])
    await api.dispose()
    return r.results[0]!
  }

  const openEntry = async (page: Page, id: string) => {
    await page.goto('registry')
    await page.getByPlaceholder('Search by ID, value, label, or composite key...').fill(id)
    await page.getByRole('button', { name: new RegExp(id) }).first().click()
    await expect(page.getByRole('heading', { name: 'Entry Detail' })).toBeVisible()
  }

  test('add a synonym; the registry resolves it to the entry', async ({ page }) => {
    await openEntry(page, acme)
    await expect(page.getByRole('heading', { name: /Synonyms \(1\)/ })).toBeVisible()
    await page.getByRole('button', { name: 'Synonym', exact: true }).click()
    // Defaults to the entry's own namespace and (plural) entity type.
    await expect(page.getByLabel('Namespace', { exact: true })).toHaveValue(ns)
    await expect(page.getByLabel('Entity Type')).toHaveValue('documents')
    // Choosing the type by its visible label must still store the registry's plural type.
    await page.getByLabel('Entity Type').selectOption({ label: 'document' })
    await page.getByLabel('Composite Key (JSON)').fill(JSON.stringify(ERP_KEY))
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Synonyms \(2\)/ })).toBeVisible()

    const found = await lookupByKey(ERP_KEY)
    expect(found.status).toBe('found')
    expect(found.entry_id).toBe(acme)
  })

  test('the by-term search finds the entry through its synonym', async ({ page }) => {
    await page.goto('registry')
    await page.getByRole('button', { name: 'By term', exact: true }).click()
    await page.getByPlaceholder(/Find by fragment/).fill(ERP_KEY.erp_id)
    await expect(page.getByRole('button', { name: new RegExp(acme) }).first()).toBeVisible()
  })

  test('remove the synonym; it no longer resolves', async ({ page }) => {
    await openEntry(page, acme)
    const synonym = page.locator('div.flex.items-start', { hasText: ERP_KEY.erp_id })
    await synonym.getByRole('button', { name: 'Remove synonym' }).click()
    await expect(page.getByRole('heading', { name: /Synonyms \(1\)/ })).toBeVisible()
    expect((await lookupByKey(ERP_KEY)).status).toBe('not_found')
  })

  test('merge a duplicate; its ID resolves to the preferred entry', async ({ page }) => {
    await openEntry(page, acme)
    await page.getByRole('button', { name: 'Merge', exact: true }).first().click()
    await page.getByLabel('Entry ID to merge (will be deprecated)').fill(duplicate)
    await page.getByRole('button', { name: 'Merge', exact: true }).last().click()
    // The duplicate's ID is now a synonym of the preferred entry.
    await expect(page.getByText(duplicate).first()).toBeVisible()

    const api = await wipApi()
    const r = await postJson<{ results: Lookup[] }>(api, '/api/registry/entries/lookup/by-id', [{ entry_id: duplicate }])
    await api.dispose()
    expect(r.results[0]!.status).toBe('found')
    expect(r.results[0]!.entry_id).toBe(acme)
  })
})
