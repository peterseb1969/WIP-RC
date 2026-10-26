import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson } from './support/wip'

// The core data path through the UI, in this run's namespace: terminology and
// term → template in the Template Builder → document through the generated
// form → edit (version 2) → delete. Each step is checked in the UI and, where
// the UI could mislead, against the WIP API.

test.describe.configure({ mode: 'serial' })

const TERMINOLOGY = 'E2E_STATUS'
const TEMPLATE = 'E2E_ITEM'

test.describe('data lifecycle', () => {
  const ns = () => run().namespace
  /** Detail page of the document the create step made (serial tests share it). */
  let documentUrl = ''

  test('create a terminology', async ({ page }) => {
    await page.goto(`terminologies?ns=${ns()}`)
    await page.getByRole('button', { name: 'Create', exact: true }).first().click()
    await page.getByPlaceholder('DOCUMENT_STATUS').fill(TERMINOLOGY)
    await page.getByPlaceholder('Document Status').fill('E2E Status')
    await page.getByRole('button', { name: 'Create', exact: true }).last().click()
    await expect(page.getByRole('link', { name: new RegExp(TERMINOLOGY) })).toBeVisible()

    const api = await wipApi()
    const list = await getJson<{ items: Array<{ value: string }> }>(api, `/api/def-store/terminologies?namespace=${ns()}&page_size=100`)
    expect(list.items.map(t => t.value)).toContain(TERMINOLOGY)
    await api.dispose()
  })

  test('add a term', async ({ page }) => {
    await page.goto(`terminologies?ns=${ns()}`)
    await page.getByRole('link', { name: new RegExp(TERMINOLOGY) }).click()
    await page.getByRole('button', { name: /add term/i }).first().click()
    await page.getByPlaceholder('term_value').fill('open')
    await page.getByPlaceholder('Display label').fill('Open')
    await page.getByRole('button', { name: /^(add|create|add term)$/i }).last().click()
    await expect(page.getByText('Open', { exact: true }).first()).toBeVisible()
  })

  test('build a template', async ({ page }) => {
    await page.goto(`templates/new?ns=${ns()}`)
    // The builder keeps its own namespace choice (it does not read ?ns=).
    await page.locator('main select').filter({ has: page.locator(`option[value="${ns()}"]`) }).first().selectOption(ns())
    await page.getByPlaceholder('TEMPLATE_VALUE').fill(TEMPLATE)
    await page.getByPlaceholder('Human-readable label').fill('E2E Item')
    // The field list's quick-add form (other inputs on the page share its placeholder).
    const quickAdd = page.locator('form', { has: page.getByRole('button', { name: 'Add', exact: true }) })
    for (const name of ['code', 'title']) {
      await quickAdd.getByPlaceholder('field_name').fill(name)
      await quickAdd.getByRole('button', { name: 'Add', exact: true }).click()
      // Adding a field opens its settings panel; close it before the next one.
      const close = page.getByRole('button', { name: 'Close field settings' })
      if (await close.isVisible()) await close.click()
    }
    await expect(page.getByText('Fields (2)', { exact: false })).toBeVisible()
    const codeChip = page.getByRole('button', { name: 'code', exact: true })
    await page.locator('div')
      .filter({ has: page.getByRole('heading', { name: 'Identity Fields' }) })
      .filter({ has: codeChip })
      .last()
      .getByRole('button', { name: 'code', exact: true })
      .click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).not.toHaveURL(/\/templates\/new/, { timeout: 15_000 })

    const api = await wipApi()
    const list = await getJson<{ items: Array<{ value: string; status: string; identity_fields?: string[] }> }>(
      api, `/api/template-store/templates?namespace=${ns()}&page_size=100`)
    const tpl = list.items.find(t => t.value === TEMPLATE)
    expect(tpl?.status).toBe('active')
    expect(tpl?.identity_fields).toEqual(['code'])
    await api.dispose()
  })

  test('create a document through the generated form', async ({ page }) => {
    await page.goto(`documents/${TEMPLATE}/new?ns=${ns()}`)
    await page.getByLabel('code').fill('A-1')
    await page.getByLabel('title').fill('First title')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/documents/${TEMPLATE}/(?!new)[^/?]+`))
    await expect(page.getByText('First title').first()).toBeVisible()
    documentUrl = page.url()
  })

  test('edit the document: version 2', async ({ page }) => {
    expect(documentUrl, 'the create step ran').not.toBe('')
    await page.goto(documentUrl)
    await page.getByRole('button', { name: /edit/i }).or(page.getByRole('link', { name: /edit/i })).first().click()
    await page.getByLabel('title').fill('Second title')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).not.toHaveURL(/\/edit/)
    await expect(page.getByText('Second title').first()).toBeVisible()

    const api = await wipApi()
    const id = new URL(documentUrl).pathname.split('/').pop()
    const doc = await getJson<{ version: number; data: Record<string, unknown> }>(api, `/api/document-store/documents/${id}`)
    expect(doc.version).toBe(2)
    expect(doc.data.title).toBe('Second title')
    await api.dispose()
  })

  test('delete the document (soft delete)', async ({ page }) => {
    expect(documentUrl, 'the create step ran').not.toBe('')
    await page.goto(documentUrl)
    await page.getByRole('button', { name: /^delete$/i }).click()
    await expect(page.getByText('Delete? It becomes inactive and keeps its history.')).toBeVisible()
    await page.getByRole('button', { name: /^confirm$/i }).click()
    // Deleting returns to the template's document list, which shows active documents only…
    await expect(page.getByText('No documents for this template.')).toBeVisible()
    // …and the toggle brings the deleted one back into view.
    await page.getByRole('button', { name: /^active$/i }).click()
    await expect(page.getByRole('button', { name: /^incl\. deleted$/i })).toBeVisible()
    await expect(page.getByText('No documents for this template.')).toBeHidden()

    const api = await wipApi()
    const id = new URL(documentUrl).pathname.split('/').pop()
    const doc = await getJson<{ status: string }>(api, `/api/document-store/documents/${id}`)
    expect(doc.status).toBe('inactive')
    await api.dispose()
  })
})
