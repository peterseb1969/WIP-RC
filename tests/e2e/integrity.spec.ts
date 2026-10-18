import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, postJson, createTemplate, createDocuments } from './support/wip'

// The Integrity page reports a broken reference the suite plants in its own
// namespace: a document whose term is hard-deleted afterwards (allowed in a
// mutable terminology, PoNIF #1's deviation) is an orphaned term reference.
// The check is instance-wide (~25 s on wip-local), so this spec looks for its
// own document among the issues rather than at the totals.

const TERMINOLOGY = 'E2E_TAGS'
const TEMPLATE = 'E2E_TAGGED'

test.describe('integrity', () => {
  test.setTimeout(120_000)

  test('a hard-deleted term shows as an orphaned reference', async ({ page }) => {
    const ns = run().namespace
    const api = await wipApi()
    const tl = await postJson<{ results: Array<{ status: string; id?: string; error?: string }> }>(api, '/api/def-store/terminologies',
      [{ value: TERMINOLOGY, label: 'E2E Tags', namespace: ns, mutable: true }])
    expect(tl.results[0]!.status, tl.results[0]!.error).toBe('created')
    const terms = await postJson<{ results: Array<{ status: string; id?: string; error?: string }> }>(api,
      `/api/def-store/terminologies/${tl.results[0]!.id}/terms?namespace=${ns}`, [{ value: 'doomed', label: 'Doomed' }])
    expect(terms.results[0]!.status, terms.results[0]!.error).toBe('created')
    await createTemplate(api, {
      value: TEMPLATE,
      label: 'E2E Tagged',
      namespace: ns,
      identity_fields: ['name'],
      fields: [
        { name: 'name', label: 'name', type: 'string', mandatory: true },
        { name: 'tag', label: 'tag', type: 'term', terminology_ref: TERMINOLOGY },
      ],
    })
    const [doc] = await createDocuments(api, ns, TEMPLATE, [{ name: 'tagged', tag: 'doomed' }])
    const del = await api.fetch('/api/def-store/terms', { method: 'DELETE', data: [{ id: terms.results[0]!.id, hard_delete: true }] })
    expect(del.ok()).toBe(true)
    await api.dispose()

    await page.goto('integrity')
    await page.getByRole('button', { name: 'Run Check' }).click()
    await expect(page.getByRole('heading', { name: /Issues \(\d+\)/ })).toBeVisible({ timeout: 90_000 })
    const issue = page.locator('div', { has: page.getByText(doc!, { exact: true }) }).filter({ hasText: 'orphaned_term_ref' }).last()
    await expect(issue).toBeVisible()
  })
})
