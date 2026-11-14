import { test, expect } from '@playwright/test'
import { wipApi, getJson, postJson } from './support/wip'
import { run } from './support/env'

// A merge writes into existing namespaces, and an archive holding several
// namespaces merges each into the one of the same name: the platform refuses
// a target_namespace for it. The panel lists every namespace with its target,
// flags one this install doesn't have, and refuses to start before the
// platform would. Nothing is merged: the check stops before any request.

interface Job { job_id: string; status: string; error?: string | null }

test('a multi-namespace merge lists each namespace into itself and flags a missing one', async ({ page }) => {
  const { namespace, twin } = run()
  const gone = `${namespace}-gone`
  const api = await wipApi()

  // Three namespaces in one archive; the third is removed before the upload.
  await postJson(api, '/api/registry/namespaces', {
    prefix: gone, description: 'RC end-to-end test run (disposable)', deletion_mode: 'full',
  })
  const started = await postJson<Job>(api, `/api/document-store/backup/namespaces/${namespace}/backup`, {
    namespaces: [twin, gone], include_files: false,
  })
  let job = started
  for (let i = 0; i < 60 && job.status !== 'complete' && job.status !== 'failed'; i++) {
    await new Promise(r => setTimeout(r, 1000))
    job = await getJson<Job>(api, `/api/document-store/backup/jobs/${started.job_id}`)
  }
  expect(job.status, job.error ?? '').toBe('complete')
  const archive = await api.get(`/api/document-store/backup/jobs/${started.job_id}/download`)
  expect(archive.ok()).toBe(true)
  const buffer = await archive.body()

  await api.delete(`/api/registry/namespaces/${gone}`)
  await expect.poll(async () => {
    const list = await getJson<{ items?: Array<{ prefix: string }> }>(api, '/api/registry/namespaces?page_size=1000')
    return (list.items ?? []).some(n => n.prefix === gone)
  }, { timeout: 30_000 }).toBe(false)
  await api.dispose()

  await page.goto('backup')
  await page.getByRole('button', { name: 'Restore', exact: true }).first().click()
  await page.locator('input[type="file"][accept=".zip"]').setInputFiles({ name: 'combined.zip', mimeType: 'application/zip', buffer })
  await expect(page.getByText(/Archive holds 3 namespaces/)).toBeVisible()
  await page.getByRole('button', { name: 'Merge', exact: true }).click()

  const targets = page.getByTestId('merge-targets')
  await expect(targets).toContainText('Each namespace merges into itself')
  for (const ns of [namespace, twin, gone]) await expect(targets).toContainText(ns)
  await expect(targets.getByText(/missing/)).toHaveCount(1)
  await expect(targets.locator('div', { hasText: gone }).last()).toContainText('missing')
  // No redirect field: the platform refuses one for this archive.
  await expect(page.getByText('Target namespace (optional)')).toHaveCount(0)
  await expect(page.getByText('Align templates by value, not version number')).toBeVisible()
  await expect(page.getByText('Retire terms the archive has retired')).toBeVisible()

  await page.getByRole('button', { name: 'Preview restore' }).click()
  await expect(page.getByText(new RegExp(`this install has no ${gone}`))).toBeVisible()
})
