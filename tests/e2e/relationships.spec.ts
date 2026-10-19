import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson, createDocuments, createTemplate } from './support/wip'

// Relationships through the UI, in this run's namespace: an edge type built in
// the Template Builder, an edge document created through the generated form
// (endpoint pickers), and the edge shown on both endpoints' Relationships
// panels. A same-named person template in the twin namespace holds a document
// the endpoint picker must not offer: a bare endpoint value means the edge's
// own namespace.

test.describe.configure({ mode: 'serial' })

const PERSON = 'E2E_PERSON'
const EDGE = 'E2E_KNOWS'

type Tpl = { template_id: string; value: string; usage?: string; source_templates?: Array<{ lookup_value: string }>; target_templates?: Array<{ lookup_value: string }> }
type Doc = { document_id: string; template_id: string; data: Record<string, unknown> }

test.describe('relationships', () => {
  let ns = ''
  const people: Record<string, string> = {}

  test.beforeAll(async () => {
    const { namespace, twin } = run()
    ns = namespace
    const api = await wipApi()
    for (const prefix of [twin, ns]) {
      await createTemplate(api, {
        value: PERSON,
        label: 'E2E Person',
        namespace: prefix,
        identity_fields: ['name'],
        fields: [{ name: 'name', label: 'name', type: 'string', mandatory: true }],
      })
    }
    await createDocuments(api, twin, PERSON, [{ name: 'Mallory' }])
    const [alice, bob] = await createDocuments(api, ns, PERSON, [{ name: 'Alice' }, { name: 'Bob' }])
    people.Alice = alice
    people.Bob = bob
    await api.dispose()
  })

  test('build an edge type', async ({ page }) => {
    await page.goto(`templates/new?ns=${ns}`)
    await page.locator('main select').filter({ has: page.locator(`option[value="${ns}"]`) }).first().selectOption(ns)
    await page.getByPlaceholder('TEMPLATE_VALUE').fill(EDGE)
    await page.getByPlaceholder('Human-readable label').fill('E2E Knows')
    await page.getByRole('button', { name: /Edge type/ }).click()
    for (const side of ['Source', 'Target']) {
      const picker = page.locator('div')
        .filter({ has: page.getByText(`${side} templates *`) })
        .filter({ has: page.getByRole('checkbox') })
        .last()
      await picker.getByRole('checkbox', { name: new RegExp(PERSON) }).check()
    }
    const quickAdd = page.locator('form', { has: page.getByRole('button', { name: 'Add', exact: true }) })
    await quickAdd.getByPlaceholder('field_name').fill('since')
    await quickAdd.getByRole('button', { name: 'Add', exact: true }).click()
    const close = page.getByRole('button', { name: 'Close field settings' })
    if (await close.isVisible()) await close.click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).not.toHaveURL(/\/templates\/new/, { timeout: 15_000 })

    const api = await wipApi()
    const list = await getJson<{ items: Tpl[] }>(api, `/api/template-store/templates?namespace=${ns}&page_size=100`)
    const edge = list.items.find(t => t.value === EDGE)
    expect(edge?.usage).toBe('relationship')
    expect(edge?.source_templates?.map(e => e.lookup_value)).toEqual([PERSON])
    expect(edge?.target_templates?.map(e => e.lookup_value)).toEqual([PERSON])
    await api.dispose()
  })

  test('create an edge through the form', async ({ page }) => {
    await page.goto(`documents?ns=${ns}&template=${EDGE}`)
    await page.getByRole('link', { name: 'New document' }).click()
    await expect(page.getByText('Endpoints')).toBeVisible()

    // Source: the picker offers this namespace's people only.
    await page.getByLabel('Source').click()
    await expect(page.getByRole('button', { name: /Alice/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Bob/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Mallory/ })).toHaveCount(0)
    await page.getByRole('button', { name: /Alice/ }).click()
    await page.getByLabel('Target').click()
    await page.getByRole('button', { name: /Bob/ }).click()
    await page.getByLabel('since').fill('2020')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/documents/${EDGE}/(?!new)[^/?]+`))

    const api = await wipApi()
    const edges = await getJson<{ items: Doc[] }>(api, `/api/document-store/documents?namespace=${ns}&template_value=${EDGE}&page_size=10`)
    expect(edges.items).toHaveLength(1)
    expect(edges.items[0].data).toMatchObject({ source_ref: people.Alice, target_ref: people.Bob, since: '2020' })
    await api.dispose()
  })

  test('the edge shows on both endpoints', async ({ page }) => {
    await page.goto(`documents/${PERSON}/${people.Alice}`)
    await page.getByRole('button', { name: 'Relationships', exact: true }).click()
    await expect(page.getByText('1 relationship', { exact: true })).toBeVisible()
    await expect(page.getByText(EDGE, { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Bob/ })).toBeVisible()
    await expect(page.getByText('since:')).toBeVisible()

    await page.goto(`documents/${PERSON}/${people.Bob}`)
    await page.getByRole('button', { name: 'Relationships', exact: true }).click()
    await page.getByRole('button', { name: 'Outgoing' }).click()
    await expect(page.getByText('No outgoing relationships', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Incoming' }).click()
    await expect(page.getByRole('link', { name: /Alice/ })).toBeVisible()
  })
})
