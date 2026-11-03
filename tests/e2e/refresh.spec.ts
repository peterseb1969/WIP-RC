import { test, expect, type Locator } from '@playwright/test'
import { run } from './support/env'
import { wipApi, postJson, createDocuments } from './support/wip'

// A Refresh button must re-read the counts on screen. The Dashboard's
// namespace totals and an expanded namespace's counts are queries of their
// own, cached for a minute; refetching only the namespace list left them
// unchanged until a browser reload. Documents written through the API
// between two reads stand in for an install filling a namespace. Other
// specs write to the same namespace, so counts are compared, not fixed.

/** The number shown in a count card ("Documents1,234" → 1234). */
async function countIn(card: Locator): Promise<number> {
  const digits = (await card.innerText()).replace(/[^\d]/g, '')
  return Number(digits)
}

async function expectCount(card: Locator, expected: number) {
  await expect.poll(() => countIn(card)).toBe(expected)
}

test('Dashboard and Namespaces Refresh show documents written since the page loaded', async ({ page }) => {
  const { namespace: ns } = run()
  const api = await wipApi()
  await postJson(api, '/api/template-store/templates', [{
    value: 'REFRESH_PROBE', label: 'Refresh probe', namespace: ns, identity_fields: ['code'],
    fields: [{ name: 'code', label: 'Code', type: 'string', mandatory: true }],
  }])
  const stamp = Date.now()

  // Dashboard, scoped to this run's namespace.
  await page.goto(`?ns=${ns}`)
  const dashboardDocs = page.locator('main a[href$="/documents"]').filter({ hasText: /\d/ }).first()
  await expect(dashboardDocs).toBeVisible()
  const before = await countIn(dashboardDocs)
  await createDocuments(api, ns, 'REFRESH_PROBE', [{ code: `${stamp}-a` }])
  await page.getByRole('button', { name: 'Refresh namespace counts' }).click()
  await expectCount(dashboardDocs, before + 1)

  // Namespaces page, with this run's namespace expanded.
  await page.goto('namespaces')
  await page.getByRole('button', { name: new RegExp(`^${ns}RC end`) }).click()
  const namespaceDocs = page.locator(`main a[href$="/documents?ns=${ns}"]`)
  await expectCount(namespaceDocs, before + 1)
  await createDocuments(api, ns, 'REFRESH_PROBE', [{ code: `${stamp}-b` }])
  await page.getByRole('button', { name: 'Refresh namespaces' }).click()
  await expectCount(namespaceDocs, before + 2)
  await api.dispose()
})

// While a read runs, the documents list says so, keeps the count on screen
// marked as updating, and takes no second click (a second click used to
// cancel the read and start it again). The read is held in the browser so
// the in-between state can be checked on any install, however fast.
test('documents list: a running refresh is shown, blocks a second click, and auto-refresh follows writes', async ({ page }) => {
  const { namespace: ns } = run()
  const api = await wipApi()
  await postJson(api, '/api/template-store/templates', [{
    value: 'REFRESH_PROBE', label: 'Refresh probe', namespace: ns, identity_fields: ['code'],
    fields: [{ name: 'code', label: 'Code', type: 'string', mandatory: true }],
  }])
  const stamp = Date.now()
  await createDocuments(api, ns, 'REFRESH_PROBE', [{ code: `${stamp}-x` }])

  let hold = false
  let release: () => void = () => {}
  let heldRequests = 0
  await page.route(url => url.pathname.endsWith('/document-store/documents'), async route => {
    if (hold) {
      heldRequests++
      await new Promise<void>(resolve => { release = resolve })
    }
    await route.continue()
  })

  await page.goto(`documents?ns=${ns}&template=REFRESH_PROBE`)
  const count = page.getByTestId('documents-count')
  await expect(count).toContainText('document')
  const before = Number((await count.innerText()).replace(/[^\d]/g, ''))

  hold = true
  await page.getByRole('button', { name: 'Refresh documents' }).click()
  const busy = page.getByRole('button', { name: 'Refreshing…' })
  await expect(busy).toBeDisabled()
  await expect(count.locator('[data-refreshing]')).toBeVisible()
  await expect(count).toContainText('updating…')
  await busy.click({ force: true })
  expect(heldRequests).toBe(1)

  hold = false
  release()
  await expect(page.getByRole('button', { name: 'Refresh documents' })).toBeEnabled()
  await expect(count.locator('[data-refreshing]')).toHaveCount(0)
  expect(heldRequests).toBe(1)

  // Auto-refresh picks up a write without a click.
  await createDocuments(api, ns, 'REFRESH_PROBE', [{ code: `${stamp}-y` }])
  await page.getByRole('button', { name: 'Auto', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Auto: on' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => Number((await count.innerText()).replace(/[^\d]/g, '')), { timeout: 20_000 }).toBe(before + 1)
  await page.getByRole('button', { name: 'Auto: on' }).click()
  await expect(page.getByRole('button', { name: 'Auto', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await api.dispose()
})
