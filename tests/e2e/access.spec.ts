import { existsSync } from 'fs'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { E2E, readSecret, run } from './support/env'
import { login } from './support/login'
import { wipApi, getJson } from './support/wip'

// A signed-in user outside the allowed groups (the deployer's viewer) is
// refused, and a write through RC's /wip proxy (which calls WIP with the
// deployment's admin key) must not land. The e2e admin is the control.
//
// Two enforcers can do the refusing, and either passes:
// - the WIP gateway, when the install declares allowed_groups on RC's route:
//   the request never reaches RC, so everything (health included) is a 403
//   {error: 'forbidden'} and the denial is the gateway's own page;
// - RC's own ALLOWED_GROUPS check, when the gateway lets the user through:
//   health stays public and the rest is a 403 {error: 'Access denied'}.
// One install uses one of them; health tells which.
// Needs the group restriction set on the install (default: wip-admins).

const TERMINOLOGY = 'E2E_VIEWER_WRITE'

const DENIAL_TEXT = "You don't have access to this app"

/** Asserts a refusal and says which enforcer produced it. */
async function refusedBy(r: { status(): number; json(): Promise<unknown> }, label: string): Promise<'gateway' | 'app'> {
  expect(r.status(), label).toBe(403)
  const body = await r.json() as { error?: string }
  if (body.error === 'forbidden') return 'gateway'
  expect(body, label).toMatchObject({ error: 'Access denied' })
  return 'app'
}

test.describe('access control', () => {
  test.describe('a user outside ALLOWED_GROUPS', () => {
    // A fresh session for the viewer, not the suite's saved admin login.
    test.use({ storageState: { cookies: [], origins: [] } })
    test.skip(!existsSync(E2E.viewerPasswordFile), `no viewer password at ${E2E.viewerPasswordFile}`)

    let rc: APIRequestContext

    test.beforeEach(async ({ page }) => {
      await login(page, E2E.viewerUser, readSecret(E2E.viewerPasswordFile))
      rc = page.request
    })

    test('is refused by the app server and its WIP proxy', async () => {
      const health = await rc.get('api/health')
      const enforcer = health.status() === 403 ? await refusedBy(health, 'api/health') : 'app'
      if (enforcer === 'app') expect(health.status(), 'api/health stays public').toBe(200)

      for (const path of ['api/app-config', 'api/me', 'wip/api/registry/namespaces']) {
        expect(await refusedBy(await rc.get(path), path), path).toBe(enforcer)
      }
    })

    test('cannot write through the proxy', async () => {
      const ns = run().namespace
      const r = await rc.post('wip/api/def-store/terminologies', {
        data: [{ value: TERMINOLOGY, label: 'Viewer write', namespace: ns }],
      })
      expect(r.status()).toBe(403)

      const api = await wipApi()
      const list = await getJson<{ items: Array<{ value: string }> }>(api, `/api/def-store/terminologies?namespace=${ns}&page_size=1000`)
      expect(list.items.map(t => t.value)).not.toContain(TERMINOLOGY)
      await api.dispose()
    })

    test('sees the denial on a data page', async ({ page }) => {
      await page.goto('namespaces')
      // RC renders it as an alert, the gateway as its page heading.
      await expect(page.getByText(DENIAL_TEXT).first()).toBeVisible()
    })
  })

  test('an allowed user gets through', async ({ page }) => {
    const r = await page.request.get('wip/api/registry/namespaces')
    expect(r.status()).toBe(200)
  })
})
