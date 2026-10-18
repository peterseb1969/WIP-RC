import { existsSync } from 'fs'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { E2E, readSecret, run } from './support/env'
import { login } from './support/login'
import { wipApi, getJson } from './support/wip'

// ALLOWED_GROUPS behind the WIP gateway: a signed-in user outside the allowed
// groups (the deployer's viewer) is refused by RC's server and by its /wip
// proxy, which calls WIP with the deployment's admin key; a write through the
// proxy must not land. Health stays public. The e2e admin is the control.
// Needs ALLOWED_GROUPS set on the install (wip-local: wip-admins).

const TERMINOLOGY = 'E2E_VIEWER_WRITE'

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
      expect(health.status()).toBe(200)

      for (const path of ['api/app-config', 'api/me', 'wip/api/registry/namespaces']) {
        const r = await rc.get(path)
        expect(r.status(), path).toBe(403)
        expect(await r.json(), path).toMatchObject({ error: 'Access denied' })
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
      await expect(page.getByRole('alert')).toContainText("You don't have access to this app")
    })
  })

  test('an allowed user gets through', async ({ page }) => {
    const r = await page.request.get('wip/api/registry/namespaces')
    expect(r.status()).toBe(200)
  })
})
