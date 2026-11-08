import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { attachmentErrorMessage, draftFrom, keysOfApp, newDraft, requestFrom } from '@/lib/attachments'

// Attachments: every write sends the full record, a per-item refusal is
// explained, an inactive record is revived by writing it again, and an app's
// keys are found by owner app:<name>. The client is mocked.

const listAttachments = vi.hoisted(() => vi.fn())
const upsertAttachments = vi.hoisted(() => vi.fn())
const deactivateAttachments = vi.hoisted(() => vi.fn())
const listAPIKeys = vi.hoisted(() => vi.fn())

vi.mock('@wip/react', () => ({
  useWipClient: () => ({ registry: { listAttachments, upsertAttachments, deactivateAttachments, listAPIKeys } }),
}))

import AttachmentsPage from '@/pages/AttachmentsPage'

const record = (over = {}) => ({
  name: 'shop', upstream: 'http://shop:8080', status: 'active',
  auth_required: true, allowed_groups: ['wip-admins'], upstream_host_header: false, streaming: false, ui_only: true,
  upstream_tls: { verify: true, ca_pem: null }, display_name: 'Shop', health: '/api/health', managed_by: null,
  created_at: '2026-11-04T10:00:00Z', created_by: 'ops', updated_at: '2026-11-04T10:00:00Z', updated_by: 'ops', ...over,
})

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={qc}><MemoryRouter><AttachmentsPage /></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => {
  for (const f of [listAttachments, upsertAttachments, deactivateAttachments, listAPIKeys]) f.mockReset()
  listAPIKeys.mockResolvedValue({ items: [{ name: 'shop-key', owner: 'app:shop' }, { name: 'other', owner: 'ops' }] })
})

describe('requestFrom', () => {
  it('sends the full record, lists split and the upstream trimmed of a slash', () => {
    const r = requestFrom({ ...newDraft(), name: 'shop', upstream: 'http://shop:8080/', allowed_groups: 'a, b ,', health: ' ' })
    expect(r).toEqual({ request: expect.objectContaining({
      name: 'shop', upstream: 'http://shop:8080', auth_required: true, allowed_groups: ['a', 'b'],
      ui_only: true, health: null, upstream_tls: { verify: true, ca_pem: null },
    }) })
  })

  it('sends none of the prefix settings the Registry now refuses', () => {
    const r = requestFrom({ ...newDraft(), name: 'shop', upstream: 'http://shop:8080' })
    expect('request' in r && Object.keys(r.request)).toEqual(expect.not.arrayContaining(['strip_prefix', 'preserve_prefix_subpaths', 'redirect_bare_path', 'path']))
  })

  it('says what to fix first', () => {
    expect(requestFrom({ ...newDraft(), name: 'Shop', upstream: 'http://x' })).toEqual({ error: expect.stringMatching(/^Name/) })
    expect(requestFrom({ ...newDraft(), name: 'shop', upstream: 'http://x/path' })).toEqual({ error: expect.stringMatching(/^Upstream/) })
    expect(requestFrom({ ...newDraft(), name: 'shop', upstream: 'http://x', auth_required: false, allowed_groups: 'g' }))
      .toEqual({ error: expect.stringMatching(/Login required/) })
  })

  it('round-trips a record read from the Registry', () => {
    const r = requestFrom(draftFrom(record() as never))
    expect('request' in r && r.request).toEqual(expect.objectContaining({ name: 'shop', allowed_groups: ['wip-admins'], health: '/api/health', display_name: 'Shop' }))
  })
})

describe('attachmentErrorMessage and keysOfApp', () => {
  it('explains the coded refusals', () => {
    expect(attachmentErrorMessage({ index: 0, status: 'error', error: 'no', error_code: 'forbidden', details: { rule: 'upstream_blocked' } }))
      .toMatch(/install's own services/)
    expect(attachmentErrorMessage({ index: 0, status: 'error', name: 'rc', error: 'no', error_code: 'name_collision' }))
      .toMatch(/already has the origin rc\.<host>/)
    expect(attachmentErrorMessage({ index: 0, status: 'error', error: 'no', error_code: 'invalid_state', details: { rule: 'no_app_edge' } }))
      .toMatch(/doesn't serve attached apps/)
  })

  it('finds an app\'s keys by owner', () => {
    expect(keysOfApp([{ name: 'a', owner: 'app:shop' }, { name: 'b', owner: 'app:shopx' }] as never, 'shop').map(k => k.name)).toEqual(['a'])
  })
})

describe('AttachmentsPage', () => {
  it('lists active records with their keys, hides inactive ones until asked', async () => {
    listAttachments.mockResolvedValue({ items: [record(), record({ name: 'old', status: 'inactive' })] })
    renderPage()
    const row = await screen.findByTestId('attachment-shop')
    // jsdom runs at localhost, not an app origin: the origin is shown generically, with no Open link.
    expect(row).toHaveTextContent('shop.<host> → http://shop:8080')
    expect(screen.queryByTestId('attachment-old')).not.toBeInTheDocument()
    expect(screen.getByText(/1 inactive hidden/)).toBeInTheDocument()
    await userEvent.click(within(row).getAllByRole('button')[0])
    expect(within(row).getByRole('link', { name: 'shop-key' })).toBeInTheDocument()
    expect(within(row).queryByRole('link', { name: /^Open/ })).not.toBeInTheDocument()
    expect(within(row).getByRole('link', { name: /Create a key for shop/ })).toHaveAttribute('href', '/api-keys?create=1&owner=app%3Ashop')
    await userEvent.click(screen.getByLabelText('Show inactive'))
    expect(screen.getByTestId('attachment-old')).toBeInTheDocument()
  })

  it('attaches with the full record and shows a per-item refusal', async () => {
    listAttachments.mockResolvedValue({ items: [] })
    upsertAttachments.mockResolvedValue({ results: [{ index: 0, status: 'error', error: 'blocked', error_code: 'forbidden', details: { rule: 'upstream_blocked' } }] })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Attach an app/ }))
    expect(screen.getByText(/Attach only apps you trust/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Name *'), 'shop')
    await userEvent.type(screen.getByLabelText('Upstream *'), 'http://wip-registry:8001')
    await userEvent.click(screen.getByRole('button', { name: 'Attach' }))
    await waitFor(() => expect(upsertAttachments).toHaveBeenCalledWith([expect.objectContaining({
      name: 'shop', upstream: 'http://wip-registry:8001', auth_required: true, allowed_groups: [],
    })]))
    expect(await screen.findByRole('alert')).toHaveTextContent(/install's own services/)
  })

  it('revives an inactive record by writing it again', async () => {
    listAttachments.mockResolvedValue({ items: [record({ status: 'inactive' })] })
    upsertAttachments.mockResolvedValue({ results: [{ index: 0, status: 'updated', name: 'shop' }] })
    renderPage()
    await userEvent.click(await screen.findByLabelText('Show inactive'))
    const row = screen.getByTestId('attachment-shop')
    await userEvent.click(within(row).getAllByRole('button')[0])
    await userEvent.click(within(row).getByRole('button', { name: 'Revive' }))
    await waitFor(() => expect(upsertAttachments).toHaveBeenCalledWith([expect.objectContaining({ name: 'shop', upstream: 'http://shop:8080' })]))
    expect(await screen.findByText('Revived shop.')).toBeInTheDocument()
  })

  it('says why an active record is not served', async () => {
    listAttachments.mockResolvedValue({ items: [record({ served: false, not_served_reason: 'no_app_edge' })] })
    renderPage()
    expect(await screen.findByTestId('attachment-shop')).toHaveTextContent('not served: this install runs no app edge')
  })

  it('shows a wip-deploy record read-only', async () => {
    listAttachments.mockResolvedValue({ items: [record({ managed_by: 'wip-deploy' })] })
    renderPage()
    const row = await screen.findByTestId('attachment-shop')
    await userEvent.click(within(row).getAllByRole('button')[0])
    expect(within(row).getByText(/wip-deploy manages this attachment/)).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })
})
