import { readFileSync } from 'fs'
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

  test('Query Pad exports CSV, and shows why an export failed', async ({ page }) => {
    await page.goto('postgres')
    await page.getByRole('button', { name: 'Query Pad' }).click()
    await page.getByLabel('Namespace for unqualified table names').selectOption(ns)
    const sql = page.getByRole('textbox', { name: 'SQL query' })
    // fill() leaves CodeMirror's completion list open over the buttons below
    // (typing and clicking closes it); Escape dismisses it.
    await sql.fill(`SELECT name, score FROM ${TABLE} ORDER BY name`)
    await sql.press('Escape')
    await page.getByRole('button', { name: 'Execute' }).click()
    await expect(page.getByText('3 rows', { exact: true })).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ])
    const csv = readFileSync(await download.path(), 'utf-8').trim().split(/\r?\n/)
    expect(csv[0]).toBe('name,score')
    expect(csv.slice(1)).toEqual(['alpha,10', 'beta,20', 'gamma,12'])

    // A bad statement is an error the user sees, not an empty file.
    await sql.fill(`SELECT no_such_column FROM ${TABLE}`)
    await sql.press('Escape')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'CSV export failed' })).toContainText('no_such_column')
  })

  test('Table Browser downloads a whole table as CSV', async ({ page }) => {
    await page.goto(`postgres?ns=${ns}&find=${TABLE}`)
    // The entity's default query surface (not its __entities view).
    await page.getByRole('button', { name: new RegExp(`^${TABLE}(?!_)`) }).first().click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'CSV', exact: true }).click(),
    ])
    expect(download.suggestedFilename()).toBe(`${ns}_${TABLE}.csv`)
    const csv = readFileSync(await download.path(), 'utf-8')
    for (const name of ['alpha', 'beta', 'gamma']) expect(csv).toContain(name)
  })

  test('Parity reports the namespace and its synced template', async ({ page }) => {
    await page.goto('postgres')
    await page.getByRole('button', { name: 'Parity', exact: true }).click()
    const card = page.locator('div.rounded-lg').filter({ has: page.getByText(ns, { exact: true }) }).first()
    await expect(card).toBeVisible({ timeout: 30_000 })
    await card.getByRole('button', { name: /Show all templates/ }).click()
    await expect(card.getByText(TEMPLATE, { exact: true })).toBeVisible()
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

  // Last: a forced rebuild drops and recreates the table the tests above read.
  test('Batch Sync force-rebuilds one template in a namespace', async ({ page }) => {
    await page.goto('postgres')
    await page.getByRole('button', { name: 'Batch Sync', exact: true }).click()
    await page.locator('main select[title^="Limits which documents are synced"]').selectOption(ns)
    await page.locator('select').filter({ has: page.locator('option', { hasText: 'Single template…' }) }).selectOption(TEMPLATE)
    await page.getByRole('button', { name: 'Advanced…' }).click()
    await page.getByRole('checkbox', { name: /Force rebuild/ }).check()
    await expect(page.getByText('force rebuild', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Sync this template' }).click()

    // The job is scoped to the namespace (a forced sync is refused without one),
    // completes, and the table is rebuilt with all rows.
    const api = await wipApi()
    type Job = { template_value: string; namespace?: string | null; status: string; documents_synced: number }
    const job = await eventually(async () => {
      const r = await getJson<{ jobs?: Job[] } | Job[]>(api, '/api/reporting-sync/sync/batch/jobs')
      const jobs = Array.isArray(r) ? r : r.jobs ?? []
      return jobs.find(j => j.template_value === TEMPLATE && j.namespace === ns && j.status === 'completed')
    }, 60_000)
    expect(job.documents_synced).toBe(3)
    await eventually(async () => {
      const r = await postJson<{ row_count: number }>(api, '/api/reporting-sync/query', {
        sql: `SELECT name FROM ${TABLE}`, params: [], namespace: ns,
      })
      return r.row_count === 3
    }, 60_000)
    await api.dispose()
  })
})
