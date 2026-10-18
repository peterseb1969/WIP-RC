import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson, postJson, eventually, createTemplate, createDocuments } from './support/wip'

// The PostgreSQL reporting layer through the UI, in this run's namespace:
// documents synced by reporting-sync are queried in the Query Pad, then a
// registered view is tested, saved, read and deleted on the Views tab.

test.describe.configure({ mode: 'serial' })

const TEMPLATE = 'E2E_METRIC'
const TABLE = 'doc_e2e_metric'
const VIEW = 'v_e2e_metric_total'

test.describe('reporting', () => {
  let ns = ''

  test.beforeAll(async () => {
    ns = run().namespace
    const api = await wipApi()
    await createTemplate(api, {
      value: TEMPLATE,
      label: 'E2E Metric',
      namespace: ns,
      identity_fields: ['name'],
      fields: [
        { name: 'name', label: 'name', type: 'string', mandatory: true },
        { name: 'score', label: 'score', type: 'integer' },
      ],
    })
    await createDocuments(api, ns, TEMPLATE, [
      { name: 'alpha', score: 10 },
      { name: 'beta', score: 20 },
      { name: 'gamma', score: 12 },
    ])
    // reporting-sync applies document events asynchronously.
    await eventually(async () => {
      const r = await postJson<{ row_count: number }>(api, '/api/reporting-sync/query', {
        sql: `SELECT name FROM ${TABLE}`, params: [], namespace: ns,
      })
      return r.row_count === 3
    }, 60_000)
    await api.dispose()
  })

  test('Query Pad runs SQL against the synced table', async ({ page }) => {
    await page.goto('postgres')
    await page.getByRole('button', { name: 'Query Pad' }).click()
    await page.getByLabel('Namespace for unqualified table names').selectOption(ns)
    await page.getByRole('textbox', { name: 'SQL query' }).fill(`SELECT name, score FROM ${TABLE} ORDER BY score DESC`)
    await page.getByRole('button', { name: 'Execute' }).click()
    await expect(page.getByText('3 rows', { exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'beta' })).toBeVisible()

    // An invalid query reports the database's error.
    await page.getByRole('textbox', { name: 'SQL query' }).fill('SELECT no_such_column FROM ' + TABLE)
    await page.getByRole('button', { name: 'Execute' }).click()
    await expect(page.getByText(/no_such_column/).last()).toBeVisible()
  })

  test('create, read and delete a registered view', async ({ page }) => {
    await page.goto('postgres')
    await page.getByRole('button', { name: 'Views' }).click()
    await page.getByRole('button', { name: 'New view' }).click()
    await page.getByLabel('Namespace *').selectOption(ns)
    await page.getByLabel('Name *').fill(VIEW)
    await page.getByRole('textbox', { name: 'View SQL' }).fill(`SELECT count(*) AS n, sum(score) AS total FROM ${TABLE}`)

    await page.getByRole('button', { name: 'Test', exact: true }).click()
    await expect(page.getByText('nothing saved yet')).toBeVisible()
    await expect(page.getByRole('cell', { name: '42' })).toBeVisible()

    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('heading', { name: VIEW })).toBeVisible()
    await expect(page.getByRole('cell', { name: '42' })).toBeVisible()

    const api = await wipApi()
    type Views = { views: Array<{ name: string; registered_by?: string | null }> }
    const views = await getJson<Views>(api, `/api/reporting-sync/namespace/${ns}/views`)
    expect(views.views.find(v => v.name === VIEW)?.registered_by).toMatch(/^rc-console:/)

    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText(/Queries that read it will stop working/)).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('heading', { name: VIEW })).toHaveCount(0)

    const after = await getJson<Views>(api, `/api/reporting-sync/namespace/${ns}/views`)
    expect(after.views.map(v => v.name)).not.toContain(VIEW)
    await api.dispose()
  })
})
