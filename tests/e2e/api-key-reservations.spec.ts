import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson } from './support/wip'

// Runtime namespace reservations on API keys, through the UI: create a key
// that reserves a namespace not yet created, see the reservation listed,
// widen the key with a plain namespace, have an invalid reservation refused
// with the Registry's reason, narrow the reserved namespace (its reservation
// is released, since it was never created), and revoke the key. No
// namespace is created: the reserved prefix stays uncreated throughout, so
// nothing depends on which apps this install's wip-deploy manages.

test.describe.configure({ mode: 'serial' })

test.describe('API key reservations', () => {
  let ns = ''
  let reservedNs = ''
  let keyName = ''

  test.beforeAll(() => {
    ;({ namespace: ns } = run())
    reservedNs = `${ns}-resv`
    keyName = `${ns}-resv-key`
  })

  // A failed run must leave neither a key nor a reservation behind.
  test.afterAll(async () => {
    const api = await wipApi()
    await api.delete(`/api/registry/api-keys/${keyName}`)
    await api.delete(`/api/registry/reservations/${reservedNs}`)
    await api.dispose()
  })

  const keyRow = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: new RegExp(`^${keyName}`) })

  test('create a key that reserves an uncreated namespace', async ({ page }) => {
    await page.goto('api-keys')
    await page.getByRole('button', { name: 'Create', exact: true }).first().click()
    await page.getByLabel('Name *').fill(keyName)
    await page.getByLabel('Namespace 1', { exact: true }).fill(reservedNs)
    await page.getByLabel(`Reserve ${reservedNs}`).check()
    await expect(page.getByText(/Reserving is for apps wip-deploy does not manage/)).toBeVisible()

    const settings = page.getByRole('group', { name: `Reservation settings for ${reservedNs}` })
    await settings.getByLabel('Deletion mode').selectOption('full')
    await expect(settings.getByText(/permanent hard deletes/)).toBeVisible()
    await settings.getByLabel('Description').fill('RC E2E reservation')
    await page.getByRole('button', { name: 'Create', exact: true }).last().click()

    await expect(page.getByText(`API key created: ${keyName}`)).toBeVisible()
    await expect(page.getByText(`Reserves, with admin: ${reservedNs}`)).toBeVisible()
    await expect(keyRow(page)).toContainText('reserves 1')

    const row = page.getByTestId(`reservation-${reservedNs}`)
    await expect(row).toContainText(`key ${keyName}`)
    await expect(row).toContainText('not created yet')
    await expect(row).toContainText('deletion_mode: full')

    // The Registry holds what the dialog sent.
    const api = await wipApi()
    const reservations = await getJson<Array<{ prefix: string; app: string; source: string; settings: Record<string, unknown> }>>(
      api, '/api/registry/reservations?source=runtime')
    const mine = reservations.find(r => r.prefix === reservedNs)
    expect(mine?.app).toBe(keyName)
    expect(mine?.settings.deletion_mode).toBe('full')
    expect(mine?.settings.description).toBe('RC E2E reservation')
    await api.dispose()
  })

  test('widen the key with a plain namespace', async ({ page }) => {
    await page.goto('api-keys')
    await keyRow(page).click()
    const editor = page.getByRole('group', { name: `Namespaces of ${keyName}` })
    await editor.getByRole('button', { name: 'Add namespace' }).click()
    await editor.getByLabel('Namespace to add').fill(ns)
    // The run namespace exists, so it can't be reserved.
    await expect(editor.getByRole('option', { name: 'reserve (admin)' })).toBeDisabled()
    await editor.getByLabel('Access on the added namespace').selectOption('write')
    await editor.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(editor.getByText(`Added ${ns} with write.`)).toBeVisible()
    await expect(editor.getByRole('button', { name: `Remove ${ns} from ${keyName}` })).toBeVisible()
  })

  test('a reservation the Registry refuses shows its reason', async ({ page }) => {
    await page.goto('api-keys')
    await keyRow(page).click()
    const editor = page.getByRole('group', { name: `Namespaces of ${keyName}` })
    await editor.getByRole('button', { name: 'Add namespace' }).click()
    // Uppercase is not a valid namespace prefix; the Registry refuses it (400).
    await editor.getByLabel('Namespace to add').fill('BAD_PREFIX')
    await editor.getByLabel('Access on the added namespace').selectOption('reserve')
    await editor.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(editor.getByText(/Invalid namespace prefix 'BAD_PREFIX'/)).toBeVisible()
    await expect(editor.getByRole('button', { name: /Remove BAD_PREFIX/ })).toHaveCount(0)
  })

  test('narrow the reserved namespace; its reservation is released', async ({ page }) => {
    await page.goto('api-keys')
    await keyRow(page).click()
    const editor = page.getByRole('group', { name: `Namespaces of ${keyName}` })
    await editor.getByRole('button', { name: `Remove ${reservedNs} from ${keyName}` }).click()
    await editor.getByRole('button', { name: 'Yes, remove' }).click()
    await expect(editor.getByText(`Removed ${reservedNs} and released its reservation (the namespace was never created).`)).toBeVisible()
    await expect(page.getByTestId(`reservation-${reservedNs}`)).toHaveCount(0)
  })

  test('revoke the key and see its grants revoked', async ({ page }) => {
    await page.goto('api-keys')
    await keyRow(page).click()
    await page.getByRole('button', { name: 'Revoke', exact: true }).click()
    await page.getByRole('button', { name: 'Yes, revoke' }).click()
    const banner = page.getByRole('status').filter({ hasText: `Revoked API key ${keyName}` })
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(`Grants revoked on: ${ns}`)
    await expect(keyRow(page)).toHaveCount(0)
  })
})
