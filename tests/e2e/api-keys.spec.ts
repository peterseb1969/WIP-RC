import { test, expect, request, type APIRequestContext } from '@playwright/test'
import { E2E, run } from './support/env'
import { wipApi, getJson, eventually } from './support/wip'

// Runtime API keys through the UI: create a key scoped to this run's namespace
// with a write grant, then use the key itself against WIP — it writes in its
// namespace and is refused in the twin — and revoke it, after which WIP
// rejects it. The plaintext is shown once, in the creation banner.

test.describe.configure({ mode: 'serial' })

test.describe('API keys', () => {
  let ns = ''
  let twin = ''
  let keyName = ''
  let plaintext = ''

  test.beforeAll(() => {
    ;({ namespace: ns, twin } = run())
    keyName = `${ns}-key`
  })

  // A failed run must not leave a live key behind.
  test.afterAll(async () => {
    const api = await wipApi()
    await api.delete(`/api/registry/api-keys/${keyName}`)
    await api.dispose()
  })

  /** A WIP API context authenticated with the created key, not the deploy key. */
  const asKey = (): Promise<APIRequestContext> => request.newContext({
    baseURL: E2E.wipURL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { 'X-API-Key': plaintext },
  })

  test('create a namespace-scoped key with a write grant', async ({ page }) => {
    await page.goto('api-keys')
    await page.getByRole('button', { name: 'Create', exact: true }).first().click()
    await page.getByLabel('Name *').fill(keyName)
    await page.getByLabel('Description').fill('RC E2E runtime key')
    await page.getByLabel(/Namespaces/).fill(ns)
    await page.getByLabel('Permission on namespaces').selectOption('write')
    await page.getByRole('button', { name: 'Create', exact: true }).last().click()

    await expect(page.getByText(`API key created: ${keyName}`)).toBeVisible()
    // The banner's own <code> (the tier advisory above the form shows a command in one too).
    const banner = page.locator('div').filter({ has: page.getByText(`API key created: ${keyName}`) }).filter({ has: page.locator('code') }).last()
    plaintext = (await banner.locator('code').innerText()).trim()
    expect(plaintext.length).toBeGreaterThan(20)
    await expect(page.getByRole('button', { name: new RegExp(keyName) })).toBeVisible()
  })

  test('the key writes in its namespace and is refused elsewhere', async () => {
    expect(plaintext, 'the create step ran').not.toBe('')
    const key = await asKey()
    // A new key reaches the services within their key cache, like a revocation.
    const created = await eventually(async () => {
      const r = await key.post('/api/def-store/terminologies', {
        data: [{ value: 'E2E_KEY_WRITE', label: 'Written with the runtime key', namespace: ns }],
      })
      return r.status() === 401 ? null : r
    }, 45_000, 2_000)
    expect(created.status()).toBe(200)
    const body = await created.json() as { results: Array<{ status: string; error?: string }> }
    expect(body.results[0].status, body.results[0].error).toBe('created')

    const elsewhere = await key.get(`/api/def-store/terminologies?namespace=${twin}`)
    expect([403, 404]).toContain(elsewhere.status())
    await key.dispose()
  })

  test('revoke the key; WIP then rejects it', async ({ page }) => {
    expect(plaintext, 'the create step ran').not.toBe('')
    await page.goto('api-keys')
    await page.getByRole('button', { name: new RegExp(keyName) }).click()
    await page.getByRole('button', { name: 'Revoke', exact: true }).click()
    await expect(page.getByText(`Revoke API key ${keyName}?`)).toBeVisible()
    await page.getByRole('button', { name: 'Yes, revoke' }).click()
    await expect(page.getByRole('button', { name: new RegExp(keyName) })).toHaveCount(0)

    const api = await wipApi()
    const keys = await getJson<{ items?: Array<{ name: string }> } | Array<{ name: string }>>(api, '/api/registry/api-keys?page_size=1000')
    expect((Array.isArray(keys) ? keys : keys.items ?? []).map(k => k.name)).not.toContain(keyName)
    await api.dispose()

    // Revocation reaches the services within their key cache (documented: 30 s).
    const key = await asKey()
    await eventually(async () => (await key.get(`/api/def-store/terminologies?namespace=${ns}`)).status() === 401, 45_000, 2_000)
    await key.dispose()
  })
})
