import { test, expect, type Page } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson, postJson, eventually, createTemplate, createDocuments } from './support/wip'

// The document form's document-reference picker, in this run's namespace. The
// field allows two target templates. The first holds more documents than the
// unsearched list shows (the most recently updated 100). Typing searches all
// of them on the server. A document of the second target template is
// offered. A document in the twin namespace, which this namespace may not
// reference, is not offered. An existing reference to a document past the
// list shows that document rather than "not found".

test.describe.configure({ mode: 'serial' })

const TARGET_A = 'E2E_REF_A'
const TARGET_B = 'E2E_REF_B'
const REFERRER = 'E2E_REFS'
const COUNT_A = 120
const BROWSE = 100

const title = (i: number) => `Alpha ${String(i).padStart(3, '0')}`

type Doc = { document_id: string; data: Record<string, unknown> }
type SearchResponse = { results: { document?: { items: Array<{ id: string }> } } }

test.describe('reference picker', () => {
  let ns = ''
  let twin = ''
  let oldest = ''
  let second = ''
  let bravo = ''

  test.beforeAll(async () => {
    test.setTimeout(90_000)
    ;({ namespace: ns, twin } = run())
    const api = await wipApi()
    const targetA = (prefix: string) => ({
      value: TARGET_A,
      label: 'E2E Ref A',
      namespace: prefix,
      identity_fields: ['code'],
      header_fields: ['title'],
      fields: [
        { name: 'code', label: 'code', type: 'string', mandatory: true },
        { name: 'title', label: 'title', type: 'string' },
      ],
    })
    await createTemplate(api, targetA(ns))
    await createTemplate(api, targetA(twin))
    await createTemplate(api, {
      value: TARGET_B,
      label: 'E2E Ref B',
      namespace: ns,
      identity_fields: ['code'],
      fields: [
        { name: 'code', label: 'code', type: 'string', mandatory: true },
        { name: 'title', label: 'title', type: 'string' },
      ],
    })
    await createTemplate(api, {
      value: REFERRER,
      label: 'E2E Refs',
      namespace: ns,
      identity_fields: ['code'],
      fields: [
        { name: 'code', label: 'code', type: 'string', mandatory: true },
        { name: 'to', label: 'to', type: 'reference', reference_type: 'document', target_templates: [TARGET_A, TARGET_B] },
      ],
    })

    // The two oldest first, so the newer ones push them off the unsearched list.
    ;[oldest, second] = await createDocuments(api, ns, TARGET_A, [{ code: 'A-001', title: title(1) }, { code: 'A-002', title: title(2) }])
    await new Promise(r => setTimeout(r, 1_100))
    await createDocuments(api, ns, TARGET_A, Array.from({ length: COUNT_A - 2 }, (_, i) => ({ code: `A-${i + 3}`, title: title(i + 3) })))
    ;[bravo] = await createDocuments(api, ns, TARGET_B, [{ code: 'BRAVO-SPECIAL', title: 'Bravo special' }])
    await createDocuments(api, twin, TARGET_A, [{ code: 'A-TWIN', title: 'Alpha twin' }])

    // Search runs on reporting: wait until it sees what the tests look for,
    // including the twin's document, so its absence in the picker means something.
    const sees = (prefix: string, template: string, query: string, id?: string) => eventually(async () => {
      const r = await postJson<SearchResponse>(api, `/api/reporting-sync/search?namespace=${prefix}&template=${template}`,
        { query, types: ['document'], mode: 'substring' })
      const ids = (r.results.document?.items ?? []).map(i => i.id)
      return id ? ids.includes(id) : ids.length > 0
    }, 45_000)
    await sees(ns, TARGET_A, title(1), oldest)
    await sees(ns, TARGET_A, title(2), second)
    await sees(ns, TARGET_B, 'Bravo special', bravo)
    await sees(twin, TARGET_A, 'Alpha twin')

    // The unsearched list is the most recently updated page: the two oldest are not on it.
    const tids = (await getJson<{ items: Array<{ template_id: string; value: string }> }>(api,
      `/api/template-store/templates?namespace=${ns}&page_size=100`)).items.filter(t => [TARGET_A, TARGET_B].includes(t.value)).map(t => t.template_id)
    const page = await postJson<{ items: Doc[] }>(api, `/api/document-store/documents/query?namespace=${ns}`, {
      filters: [{ field: 'template_id', operator: 'in', value: tids }], status: 'active', page_size: BROWSE, sort_by: 'updated_at', sort_order: 'desc',
    })
    const listed = page.items.map(d => d.document_id)
    expect(listed).not.toContain(oldest)
    expect(listed).not.toContain(second)
    await api.dispose()
  })

  const docByCode = async (code: string) => {
    const api = await wipApi()
    const r = await getJson<{ items: Doc[] }>(api, `/api/document-store/documents?namespace=${ns}&template_value=${REFERRER}&page_size=100`)
    await api.dispose()
    return r.items.find(d => d.data.code === code)
  }

  const openNew = async (page: Page, code: string) => {
    await page.goto(`documents?ns=${ns}&template=${REFERRER}`)
    await page.getByRole('link', { name: 'New document' }).click()
    await page.getByLabel('code').fill(code)
    await page.getByLabel('to').click()
  }

  const create = async (page: Page) => {
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/documents/${REFERRER}/(?!new)[^/?]+`))
  }

  test('a document past the unsearched list is found by search and saved', async ({ page }) => {
    await openNew(page, 'R-1')
    await expect(page.getByText(`Showing the ${BROWSE} most recently updated of ${COUNT_A + 1} documents`)).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(title(1)) })).toHaveCount(0)
    await page.getByLabel('Search', { exact: true }).fill(title(1))
    await page.getByRole('button', { name: new RegExp(`${title(1)}.*${TARGET_A}`) }).click()
    await expect(page.getByLabel('to')).toContainText(title(1))
    await create(page)
    expect((await docByCode('R-1'))?.data.to).toBe(oldest)
  })

  test("the second target template's documents are offered, named by identity", async ({ page }) => {
    await openNew(page, 'R-2')
    await page.getByLabel('Search', { exact: true }).fill('bravo spec')
    await page.getByRole('button', { name: new RegExp(`BRAVO-SPECIAL.*${TARGET_B}`) }).click()
    await create(page)
    expect((await docByCode('R-2'))?.data.to).toBe(bravo)
  })

  test('a namespace the field may not reference is not searched', async ({ page }) => {
    await openNew(page, 'R-3')
    await page.getByLabel('Search', { exact: true }).fill('Alpha twin')
    await expect(page.getByText('No documents match.')).toBeVisible()
  })

  test('an existing reference past the unsearched list shows its document', async ({ page }) => {
    const api = await wipApi()
    const [id] = await createDocuments(api, ns, REFERRER, [{ code: 'R-4', to: second }])
    await api.dispose()
    await page.goto(`documents/${REFERRER}/${id}/edit`)
    await expect(page.getByLabel('to')).toContainText(title(2))
    await expect(page.getByLabel('to')).not.toContainText('not found')
  })
})
