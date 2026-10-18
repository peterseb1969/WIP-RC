import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson, createTemplate } from './support/wip'

// File imports through the UI, in this run's namespace: a terminology created
// from a CSV, more terms added to it from a second CSV (re-imports skip what
// exists), and documents imported from a CSV through the column-mapping wizard,
// with term values (and an alias) resolved and a bad row reported, not fatal.

test.describe.configure({ mode: 'serial' })

const TERMINOLOGY = 'E2E_COLORS'
const TEMPLATE = 'E2E_IMPORT_ITEM'

const csv = (rows: string[]) => Buffer.from(rows.join('\n') + '\n')

test.describe('imports', () => {
  const ns = () => run().namespace

  test('create a terminology from a CSV', async ({ page }) => {
    await page.goto(`terminologies?ns=${ns()}`)
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e_colors.csv',
      mimeType: 'text/csv',
      buffer: csv(['value,label,aliases', 'red,Red,Crimson|Scarlet', 'green,Green,', 'blue,Blue,']),
    })
    // The name comes from the file; the namespace from the page's filter.
    await expect(page.getByText('Value * (UPPER_SNAKE_CASE)')).toBeVisible()
    await page.getByRole('button', { name: 'Import', exact: true }).last().click()
    await expect(page.getByText('Terms: 3 created')).toBeVisible()
    await page.getByRole('button', { name: /Open terminology/ }).click()
    // The label defaults to the file name.
    await expect(page.getByRole('heading', { level: 1, name: 'e2e colors' })).toBeVisible()

    const api = await wipApi()
    const list = await getJson<{ items: Array<{ value: string; terminology_id: string }> }>(
      api, `/api/def-store/terminologies?namespace=${ns()}&page_size=100`)
    const tid = list.items.find(t => t.value === TERMINOLOGY)?.terminology_id
    expect(tid, `${TERMINOLOGY} exists in ${ns()}`).toBeTruthy()
    const terms = await getJson<{ items: Array<{ value: string; aliases?: string[] }> }>(
      api, `/api/def-store/terminologies/${tid}/terms?page_size=100`)
    expect(terms.items.map(t => t.value).sort()).toEqual(['blue', 'green', 'red'])
    expect(terms.items.find(t => t.value === 'red')?.aliases).toEqual(expect.arrayContaining(['Crimson', 'Scarlet']))
    await api.dispose()
  })

  test('import more terms into the terminology; existing ones are skipped', async ({ page }) => {
    await page.goto(`terminologies?ns=${ns()}`)
    await page.getByRole('link', { name: new RegExp(TERMINOLOGY) }).click()
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'more.csv',
      mimeType: 'text/csv',
      buffer: csv(['value,label', 'red,Red', 'yellow,Yellow']),
    })
    await page.getByRole('button', { name: 'Import', exact: true }).last().click()
    await expect(page.getByText(/Terms: 1 created, 1 skipped/)).toBeVisible()
    await expect(page.getByText('Yellow', { exact: true }).first()).toBeVisible()
  })

  test('import documents from a CSV', async ({ page }) => {
    // Fixture: a template with a term field drawing from the imported terminology.
    const api = await wipApi()
    await createTemplate(api, {
      value: TEMPLATE,
      label: 'E2E Import Item',
      namespace: ns(),
      identity_fields: ['code'],
      fields: [
        { name: 'code', label: 'Code', type: 'string', mandatory: true },
        { name: 'name', label: 'Name', type: 'string' },
        { name: 'color', label: 'Color', type: 'term', terminology_ref: TERMINOLOGY },
      ],
    })

    // The list page sets the namespace filter; its Import link carries the template.
    await page.goto(`documents?ns=${ns()}&template=${TEMPLATE}`)
    await page.getByRole('link', { name: 'Import', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Import Documents' })).toBeVisible()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'items.csv',
      mimeType: 'text/csv',
      buffer: csv(['Code,Name,Color', 'I-1,Apple,red', 'I-2,Cherry,Crimson', 'I-3,Leaf,green', 'I-4,Ghost,purple']),
    })
    await expect(page.getByText('items.csv')).toBeVisible()
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    // Headers match the field labels, so every column maps itself.
    for (const [header, field] of [['Code', 'code'], ['Name', 'name'], ['Color', 'color']]) {
      const row = page.locator('div', { has: page.getByText(header, { exact: true }) }).filter({ has: page.locator('select') }).last()
      await expect(row.locator('select')).toHaveValue(field)
    }
    await page.getByRole('button', { name: 'Start Import' }).click()

    // Three rows import; the unknown color is reported per row, not fatal.
    await expect(page.getByText('Total Rows')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Imported documents (3)')).toBeVisible()
    await expect(page.getByText('Errors (1)')).toBeVisible()
    await expect(page.getByRole('row', { name: /purple/ })).toBeVisible()

    type Doc = { data: Record<string, unknown>; term_references: Array<{ field_path: string; term_id: string; matched_via: string }> }
    const docs = await getJson<{ items: Doc[] }>(
      api, `/api/document-store/documents?namespace=${ns()}&template_value=${TEMPLATE}&page_size=100`)
    expect(docs.items.map(d => d.data.code).sort()).toEqual(['I-1', 'I-2', 'I-3'])
    // "Crimson" resolved through the alias to the same term as I-1's "red";
    // the submitted value is kept as-is.
    const cherry = docs.items.find(d => d.data.code === 'I-2')!
    expect(cherry.data.color).toBe('Crimson')
    const ref = cherry.term_references.find(r => r.field_path === 'color')
    expect(ref?.matched_via).toBe('alias')
    const apple = docs.items.find(d => d.data.code === 'I-1')!
    expect(ref?.term_id).toBe(apple.term_references.find(r => r.field_path === 'color')?.term_id)
    await api.dispose()

    await page.getByRole('link', { name: 'View Documents' }).click()
    await expect(page.getByText('Apple').or(page.getByText('I-1')).first()).toBeVisible()
  })
})
