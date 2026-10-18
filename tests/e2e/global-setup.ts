import { chromium, type FullConfig } from '@playwright/test'
import { E2E, NAMESPACE_PREFIX, readSecret, writeRun } from './support/env'
import { wipApi, getJson, postJson } from './support/wip'
import { login } from './support/login'

/**
 * Before the run: remove namespaces left by earlier (aborted) runs, create this
 * run's disposable namespace, and log in through Dex once so every test reuses
 * the saved session.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const api = await wipApi()
  const existing = await getJson<{ items?: Array<{ prefix: string }> } | Array<{ prefix: string }>>(api, '/api/registry/namespaces?page_size=1000')
  const list = Array.isArray(existing) ? existing : existing.items ?? []
  for (const ns of list.filter(n => n.prefix.startsWith(NAMESPACE_PREFIX))) {
    await api.delete(`/api/registry/namespaces/${encodeURIComponent(ns.prefix)}`)
  }

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const namespace = `${NAMESPACE_PREFIX}${stamp}`
  const twin = `${namespace}-twin`
  for (const prefix of [namespace, twin]) {
    await postJson(api, '/api/registry/namespaces', {
      prefix,
      description: 'RC end-to-end test run (disposable)',
      deletion_mode: 'full',
    })
  }
  writeRun({ namespace, twin })
  await api.dispose()

  const browser = await chromium.launch({ channel: 'chrome' })
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  await login(await context.newPage(), E2E.user, readSecret(E2E.passwordFile))
  await context.storageState({ path: E2E.stateFile })
  await browser.close()
}
