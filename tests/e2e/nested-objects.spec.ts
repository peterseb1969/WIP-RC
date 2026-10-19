import { test, expect, type Page } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson, postJson, createTemplate, createDocuments } from './support/wip'

// Nested template objects in the document form, in this run's namespace: an
// array whose items are a template (`array_template_ref`, pinned version) and
// an object field shaped by the same template. Items are filled through
// sub-forms, including a term field inside an item. Removing an item keeps the
// other items' values. Clearing a field inside the object deletes it on save
// (the edit is sent as a merge patch, which would otherwise keep the old key).
// A missing nested mandatory field is reported by the platform.

test.describe.configure({ mode: 'serial' })

const TERMINOLOGY = 'E2E_KIND'
const SUB = 'E2E_SUB'
const TEMPLATE = 'E2E_NEST'

type Doc = { document_id: string; data: Record<string, unknown> }

test.describe('nested objects', () => {
  let ns = ''

  test.beforeAll(async () => {
    ns = run().namespace
    const api = await wipApi()
    const tl = await postJson<{ results: Array<{ status: string; id?: string; error?: string }> }>(api, '/api/def-store/terminologies',
      [{ value: TERMINOLOGY, label: 'E2E Kind', namespace: ns }])
    expect(tl.results[0]!.status, tl.results[0]!.error).toBe('created')
    const terms = await postJson<{ results: Array<{ status: string; error?: string }> }>(api,
      `/api/def-store/terminologies/${tl.results[0]!.id}/terms?namespace=${ns}`,
      [{ value: 'alpha', label: 'Alpha' }, { value: 'beta', label: 'Beta' }])
    expect(terms.results.map(r => r.status)).toEqual(['created', 'created'])
    await createTemplate(api, {
      value: SUB,
      label: 'E2E Sub',
      namespace: ns,
      identity_fields: [],
      fields: [
        { name: 'name', label: 'name', type: 'string', mandatory: true },
        { name: 'kind', label: 'kind', type: 'term', terminology_ref: TERMINOLOGY },
        { name: 'n', label: 'n', type: 'integer' },
      ],
    })
    await createTemplate(api, {
      value: TEMPLATE,
      label: 'E2E Nest',
      namespace: ns,
      identity_fields: ['code'],
      fields: [
        { name: 'code', label: 'code', type: 'string', mandatory: true },
        { name: 'items', label: 'items', type: 'array', array_item_type: 'object', array_template_ref: SUB, array_template_ref_version: 1 },
        { name: 'one', label: 'one', type: 'object', template_ref: SUB, template_ref_version: 1 },
      ],
    })
    await api.dispose()
  })

  const doc = async (id: string) => {
    const api = await wipApi()
    const d = await getJson<Doc>(api, `/api/document-store/documents/${id}`)
    await api.dispose()
    return d
  }

  const docByCode = async (code: string) => {
    const api = await wipApi()
    const r = await getJson<{ items: Doc[] }>(api, `/api/document-store/documents?namespace=${ns}&template_value=${TEMPLATE}&page_size=100`)
    await api.dispose()
    return r.items.find(d => d.data.code === code)
  }

  const openNew = async (page: Page, code: string) => {
    await page.goto(`documents?ns=${ns}&template=${TEMPLATE}`)
    await page.getByRole('link', { name: 'New document' }).click()
    await page.getByLabel('code').fill(code)
  }

  const items = (page: Page) => page.getByRole('group', { name: 'items' })
  const item = (page: Page, n: number) => items(page).getByRole('group', { name: `Item ${n}` })

  test('array items and an object are filled through sub-forms', async ({ page }) => {
    await openNew(page, 'N-1')
    await items(page).getByRole('button', { name: 'Add item' }).click()
    await items(page).getByRole('button', { name: 'Add item' }).click()
    await item(page, 1).getByLabel(/^name\*?$/).fill('first')
    await item(page, 1).getByLabel('kind', { exact: true }).click()
    await item(page, 1).getByRole('button', { name: /Alpha.*alpha/ }).click()
    await item(page, 1).getByLabel('n', { exact: true }).fill('1')
    await item(page, 2).getByLabel(/^name\*?$/).fill('second')
    await page.getByRole('group', { name: 'one' }).getByLabel(/^name\*?$/).fill('solo')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/documents/${TEMPLATE}/(?!new)[^/?]+`))
    expect((await docByCode('N-1'))?.data).toMatchObject({
      items: [{ name: 'first', kind: 'alpha', n: 1 }, { name: 'second' }],
      one: { name: 'solo' },
    })
  })

  test('removing an item keeps the other items’ values', async ({ page }) => {
    const id = (await docByCode('N-1'))!.document_id
    await page.goto(`documents/${TEMPLATE}/${id}/edit`)
    await expect(item(page, 2).getByLabel(/^name\*?$/)).toHaveValue('second')
    await items(page).getByRole('button', { name: 'Remove item 1' }).click()
    await expect(item(page, 1).getByLabel(/^name\*?$/)).toHaveValue('second')
    await expect(item(page, 2)).toHaveCount(0)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).not.toHaveURL(/\/edit/)
    expect((await doc(id)).data.items).toEqual([{ name: 'second' }])
  })

  test('clearing a field inside the object deletes it on save', async ({ page }) => {
    const api = await wipApi()
    const [id] = await createDocuments(api, ns, TEMPLATE, [{ code: 'N-2', one: { name: 'o', kind: 'beta' } }])
    await api.dispose()
    await page.goto(`documents/${TEMPLATE}/${id}/edit`)
    const one = page.getByRole('group', { name: 'one' })
    await expect(one.getByLabel('kind', { exact: true })).toContainText('Beta')
    await one.getByTitle('Clear').click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).not.toHaveURL(/\/edit/)
    expect((await doc(id!)).data.one).toEqual({ name: 'o' })
  })

  test('a missing nested mandatory field is reported', async ({ page }) => {
    await openNew(page, 'N-3')
    await items(page).getByRole('button', { name: 'Add item' }).click()
    await item(page, 1).getByLabel('n', { exact: true }).fill('7')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('items[0].name')
    expect(await docByCode('N-3')).toBeUndefined()
  })
})
