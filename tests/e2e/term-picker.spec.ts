import { test, expect, type Page } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson, postJson, createTemplate, createDocuments } from './support/wip'

// The document form's term picker on a terminology larger than one list page
// (1000 terms), in this run's namespace. The dropdown lists the first page;
// typing searches the whole terminology on the server, including a term's
// names. A term past the first page can be picked and saved, a term can be
// found by a name that is neither its value nor its label, and an existing
// document whose term lies past the first page shows that term rather than
// "not found".

test.describe.configure({ mode: 'serial' })

const TERMINOLOGY = 'E2E_BIG'
const TEMPLATE = 'E2E_TERMPICK'
const TERM_COUNT = 1050
const PAGE = 1000
const ALIASED = 'T0500'
const ALIAS = 'Zanzibarium'

const value = (i: number) => `T${String(i).padStart(4, '0')}`
const label = (v: string) => `Item ${v.slice(1)}`

type Doc = { document_id: string; data: Record<string, unknown> }

test.describe('term picker', () => {
  let ns = ''
  /** Terms the picker's unsearched list does not reach: not on the first page. */
  let beyond: string[] = []

  test.beforeAll(async () => {
    test.setTimeout(60_000)
    ns = run().namespace
    const api = await wipApi()
    const tl = await postJson<{ results: Array<{ status: string; id?: string; error?: string }> }>(api, '/api/def-store/terminologies',
      [{ value: TERMINOLOGY, label: 'E2E Big', namespace: ns }])
    expect(tl.results[0]!.status, tl.results[0]!.error).toBe('created')
    const tid = tl.results[0]!.id!

    const terms = Array.from({ length: TERM_COUNT }, (_, i) => {
      const v = value(i + 1)
      return v === ALIASED ? { value: v, label: label(v), names: [{ value: ALIAS }] } : { value: v, label: label(v) }
    })
    const res = await postJson<{ results: Array<{ status: string; error?: string }> }>(api,
      `/api/def-store/terminologies/${tid}/terms?namespace=${ns}`, terms)
    const failed = res.results.filter(r => r.status !== 'created')
    expect(failed, JSON.stringify(failed.slice(0, 3))).toEqual([])

    // The same first page the picker loads; everything else is out of its reach.
    const first = await getJson<{ items: Array<{ value: string }> }>(api,
      `/api/def-store/terminologies/${tid}/terms?status=active&page_size=${PAGE}`)
    const listed = new Set(first.items.map(t => t.value))
    beyond = terms.map(t => t.value).filter(v => !listed.has(v))
    expect(beyond).toHaveLength(TERM_COUNT - PAGE)

    await createTemplate(api, {
      value: TEMPLATE,
      label: 'E2E Term Pick',
      namespace: ns,
      identity_fields: ['code'],
      fields: [
        { name: 'code', label: 'code', type: 'string', mandatory: true },
        { name: 'tag', label: 'tag', type: 'term', terminology_ref: TERMINOLOGY },
      ],
    })
    await api.dispose()
  })

  const docByCode = async (code: string) => {
    const api = await wipApi()
    const r = await getJson<{ items: Doc[] }>(api, `/api/document-store/documents?namespace=${ns}&template_value=${TEMPLATE}&page_size=100`)
    await api.dispose()
    return r.items.find(d => d.data.code === code)
  }

  const openNew = async (page: Page) => {
    await page.goto(`documents?ns=${ns}&template=${TEMPLATE}`)
    await page.getByRole('link', { name: 'New document' }).click()
    await expect(page.getByLabel('code')).toBeVisible()
  }

  const pickBySearch = async (page: Page, query: string, row: RegExp) => {
    await page.getByLabel('tag').click()
    await expect(page.getByText(`Showing the first ${PAGE} of ${TERM_COUNT} terms`)).toBeVisible()
    await page.getByLabel('Search terms').fill(query)
    await page.getByRole('button', { name: row }).click()
  }

  test('a term past the first page is found by search and saved', async ({ page }) => {
    const target = beyond[0]!
    await openNew(page)
    await page.getByLabel('code').fill('PICK-1')
    await pickBySearch(page, label(target), new RegExp(`${label(target)}.*${target}`))
    await expect(page.getByLabel('tag')).toContainText(label(target))
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/documents/${TEMPLATE}/(?!new)[^/?]+`))
    expect((await docByCode('PICK-1'))?.data.tag).toBe(target)
  })

  test('a term is found by one of its names', async ({ page }) => {
    await openNew(page)
    await page.getByLabel('code').fill('PICK-2')
    await pickBySearch(page, 'zanzib', new RegExp(`${label(ALIASED)}.*also known as ${ALIAS}`))
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/documents/${TEMPLATE}/(?!new)[^/?]+`))
    expect((await docByCode('PICK-2'))?.data.tag).toBe(ALIASED)
  })

  test('an existing document shows its term past the first page', async ({ page }) => {
    const target = beyond[1]!
    const api = await wipApi()
    const [id] = await createDocuments(api, ns, TEMPLATE, [{ code: 'PICK-3', tag: target }])
    await api.dispose()
    await page.goto(`documents/${TEMPLATE}/${id}/edit`)
    await expect(page.getByLabel('tag')).toContainText(label(target))
    await expect(page.getByLabel('tag')).not.toContainText('not found')
  })
})
