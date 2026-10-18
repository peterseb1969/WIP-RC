import { test, expect } from '@playwright/test'
import { run } from './support/env'
import { wipApi, getJson, createTemplate } from './support/wip'

// Files through the UI, in this run's namespace: upload on the Files page
// (an orphan until a document references it), download returns the same
// bytes, a document's file field uploads and links a file, the file page lists
// the referencing document and warns before deleting it, and an orphan can be
// deleted.

test.describe.configure({ mode: 'serial' })

const TEMPLATE = 'E2E_ASSET'
const NOTE = 'e2e-note.txt'
const NOTE_TEXT = 'RC end-to-end upload\n'
const ATTACHMENT = 'e2e-attachment.txt'

type FileEntity = { file_id: string; filename: string; status: string; reference_count: number; namespace: string }

test.describe('files', () => {
  let ns = ''
  let noteUrl = ''

  test.beforeAll(async () => {
    ns = run().namespace
    const api = await wipApi()
    await createTemplate(api, {
      value: TEMPLATE,
      label: 'E2E Asset',
      namespace: ns,
      identity_fields: ['name'],
      fields: [
        { name: 'name', label: 'name', type: 'string', mandatory: true },
        { name: 'attachment', label: 'attachment', type: 'file', file_config: { allowed_types: ['text/*'], max_size_mb: 1, multiple: false } },
      ],
    })
    await api.dispose()
  })

  const filesIn = async () => {
    const api = await wipApi()
    const r = await getJson<{ items: FileEntity[] }>(api, `/api/document-store/files?namespace=${ns}&page_size=100`)
    await api.dispose()
    return r.items
  }

  test('upload a file; unreferenced, it shows as an orphan', async ({ page }) => {
    await page.goto(`files?ns=${ns}`)
    await page.getByRole('button', { name: 'Upload', exact: true }).first().click()
    await page.locator('input[type="file"]').setInputFiles({ name: NOTE, mimeType: 'text/plain', buffer: Buffer.from(NOTE_TEXT) })
    await expect(page.getByText(NOTE).first()).toBeVisible()
    await page.getByLabel('Namespace *').selectOption(ns)
    await page.getByLabel('Description').fill('uploaded by the E2E suite')
    await page.getByRole('button', { name: 'Upload', exact: true }).last().click()

    const row = page.getByRole('link', { name: new RegExp(NOTE) })
    await expect(row).toBeVisible()
    await expect(row.getByText('orphan', { exact: true }).first()).toBeVisible()

    const files = await filesIn()
    const note = files.find(f => f.filename === NOTE)
    expect(note?.reference_count).toBe(0)
    noteUrl = `files/${note!.file_id}`
  })

  test('download returns the uploaded bytes', async ({ page }) => {
    expect(noteUrl, 'the upload step ran').not.toBe('')
    await page.goto(noteUrl)
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(NOTE) })).toBeVisible()
    const href = await page.getByRole('link', { name: 'Download' }).getAttribute('href')
    expect(href).toBeTruthy()
    const r = await page.request.get(href!)
    expect(r.status()).toBe(200)
    expect(await r.text()).toBe(NOTE_TEXT)
  })

  test('a document\'s file field uploads and links the file', async ({ page }) => {
    await page.goto(`documents?ns=${ns}&template=${TEMPLATE}`)
    await page.getByRole('link', { name: 'New document' }).click()
    await page.getByLabel('name').fill('with attachment')
    await page.locator('form input[type="file"], main input[type="file"]').first()
      .setInputFiles({ name: ATTACHMENT, mimeType: 'text/plain', buffer: Buffer.from('attached\n') })
    await expect(page.getByText(ATTACHMENT).first()).toBeVisible()
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/documents/${TEMPLATE}/(?!new)[^/?]+`))

    const attachment = (await filesIn()).find(f => f.filename === ATTACHMENT)
    expect(attachment, 'the field uploaded into the document namespace').toBeTruthy()
    const api = await wipApi()
    const docs = await getJson<{ items: Array<{ document_id: string; data: Record<string, unknown> }> }>(
      api, `/api/document-store/documents?namespace=${ns}&template_value=${TEMPLATE}&page_size=10`)
    await api.dispose()
    expect(docs.items[0].data.attachment).toBe(attachment!.file_id)

    // The file page lists the referencing document and warns before a delete.
    await page.goto(`files/${attachment!.file_id}`)
    await expect(page.getByRole('heading', { name: /Referencing Documents \(1\)/ })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(docs.items[0].document_id) })).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText(/referenced by 1 document/)).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect((await filesIn()).find(f => f.filename === ATTACHMENT)?.status).toBe('active')
  })

  test('delete an orphan', async ({ page }) => {
    expect(noteUrl, 'the upload step ran').not.toBe('')
    await page.goto(noteUrl)
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('button', { name: 'Yes, delete' }).click()
    await expect(page).toHaveURL(/\/files$/)

    const api = await wipApi()
    const id = noteUrl.split('/').pop()
    const note = await getJson<FileEntity>(api, `/api/document-store/files/${id}`)
    await api.dispose()
    expect(note.status).not.toBe('active')
  })
})
