import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson } from './support/wip'

// Records wip-deploy owns (the install's key file and reservations file,
// imported by the Registry) are shown read-only, with the wip-deploy command
// to use instead. The records are this install's own: the spec looks them up
// through the API and skips what the install doesn't have, so it does not
// depend on which apps an install runs. It changes nothing.

interface KeyItem { name: string; managed_by?: string | null; grants?: Record<string, string> | null; namespaces: string[] | null }
interface GrantItem { subject: string; subject_type: string; managed_by?: string | null }
interface ReservationItem { prefix: string; managed_by?: string | null }

test.describe('records managed by wip-deploy', () => {
  let managedKey: KeyItem | undefined
  let grantedKey: KeyItem | undefined
  let managedGrantNs: string | undefined
  let managedReservation: string | undefined

  test.beforeAll(async () => {
    const api = await wipApi()
    const keys = await getJson<{ items: KeyItem[] }>(api, '/api/registry/api-keys?page_size=1000')
    const managed = keys.items.filter(k => k.managed_by === 'wip-deploy')
    managedKey = managed.find(k => k.name.startsWith('app-')) ?? managed[0]
    grantedKey = managed.find(k => k.grants && Object.keys(k.grants).length > 0)
    if (grantedKey) {
      for (const ns of grantedKey.namespaces ?? []) {
        const grants = await getJson<GrantItem[]>(api, `/api/registry/namespaces/${ns}/grants`)
        if (grants.some(g => g.subject === grantedKey!.name && g.managed_by === 'wip-deploy')) { managedGrantNs = ns; break }
      }
    }
    const reservations = await getJson<ReservationItem[]>(api, '/api/registry/reservations')
    managedReservation = reservations.find(r => r.managed_by === 'wip-deploy')?.prefix
    await api.dispose()
  })

  test('a wip-deploy key is read-only and names the command', async ({ page }) => {
    test.skip(!managedKey, 'this install has no key managed by wip-deploy')
    await page.goto('api-keys')
    const row = page.getByRole('button', { name: new RegExp(`^${managedKey!.name}`) })
    await expect(row).toContainText('wip-deploy')
    await row.click()
    await expect(page.getByTestId('managed-key-hint')).toContainText(`wip-deploy rotate-key ${managedKey!.name}`)
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Revoke', exact: true })).toHaveCount(0)
    await expect(page.getByRole('group', { name: `Namespaces of ${managedKey!.name}` })).toHaveCount(0)
  })

  test('a wip-deploy reservation offers no Release', async ({ page }) => {
    test.skip(!managedReservation, 'this install has no reservation managed by wip-deploy')
    await page.goto('api-keys')
    const row = page.getByTestId(`reservation-${managedReservation}`)
    await expect(row).toContainText('(wip-deploy)')
    await expect(row.getByRole('button')).toHaveCount(0)
  })

  test('a wip-deploy grant cannot be revoked, and its key is not offered a new grant', async ({ page }) => {
    test.skip(!managedGrantNs, 'this install has no grant managed by wip-deploy')
    const { namespace: ns } = run()

    await page.goto('namespaces')
    await page.getByRole('button', { name: new RegExp(`^${managedGrantNs}`) }).first().click()
    await page.getByText(/^Grants/).first().click()
    const grantRow = page.locator('div').filter({ hasText: new RegExp(`^${grantedKey!.name}`) }).filter({ has: page.getByText('wip-deploy') }).last()
    await expect(grantRow).toBeVisible()
    await expect(grantRow.getByTitle('Revoke grant')).toHaveCount(0)

    // In this run's own namespace, a grant to that key is not offered.
    await page.goto('namespaces')
    await page.getByRole('button', { name: new RegExp(`^${ns}RC end`) }).click()
    await page.getByText(/^Grants/).first().click()
    await page.getByRole('button', { name: /Add grant/ }).click()
    await page.getByPlaceholder('key name').fill(grantedKey!.name)
    await expect(page.getByRole('alert')).toContainText(`${grantedKey!.name}'s grants are declared in the install's key file`)
    await expect(page.getByRole('button', { name: 'Grant', exact: true })).toBeDisabled()
  })
})
