import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { APIKeyInfo } from '@wip/client'

// A runtime key's namespaces change one at a time through the Registry's
// widen and narrow calls, never through the key update, so the grant and
// any reservation follow the scope. The client is mocked; what is under
// test is which call the editor makes and what the operator is told.

const addAPIKeyNamespace = vi.hoisted(() => vi.fn())
const removeAPIKeyNamespace = vi.hoisted(() => vi.fn())
const updateAPIKey = vi.hoisted(() => vi.fn())

vi.mock('@wip/react', () => ({
  useWipClient: () => ({ registry: { addAPIKeyNamespace, removeAPIKeyNamespace, updateAPIKey } }),
  useNamespaces: () => ({ data: [{ prefix: 'kb', status: 'active' }, { prefix: 'app', status: 'active' }] }),
}))

import KeyNamespacesEditor from '@/components/api-keys/KeyNamespacesEditor'

const key = (over: Partial<APIKeyInfo> = {}): APIKeyInfo => ({
  name: 'app-key',
  owner: 'ops',
  groups: [],
  description: null,
  created_at: '2026-11-02T10:00:00Z',
  expires_at: null,
  enabled: true,
  namespaces: ['app', 'new-app'],
  created_by: null,
  source: 'runtime',
  reserved_namespaces: ['new-app'],
  ...over,
})

function renderEditor(apiKey: APIKeyInfo) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <KeyNamespacesEditor apiKey={apiKey} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  addAPIKeyNamespace.mockReset()
  removeAPIKeyNamespace.mockReset()
  updateAPIKey.mockReset()
})

describe('KeyNamespacesEditor', () => {
  it('marks the reserved namespace', () => {
    renderEditor(key())
    expect(screen.getByText('reserved')).toBeInTheDocument()
  })

  it('narrows through removeAPIKeyNamespace and reports a released reservation', async () => {
    removeAPIKeyNamespace.mockResolvedValue({ name: 'app-key', prefix: 'new-app', namespaces: ['app'], reservation: 'released' })
    renderEditor(key())
    await userEvent.click(screen.getByRole('button', { name: 'Remove new-app from app-key' }))
    expect(screen.getByText(/Its reservation is released if the namespace was never created/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))
    await waitFor(() => expect(removeAPIKeyNamespace).toHaveBeenCalledWith('app-key', 'new-app'))
    expect(await screen.findByText(/released its reservation/)).toBeInTheDocument()
    expect(updateAPIKey).not.toHaveBeenCalled()
  })

  it('reports a kept reservation', async () => {
    removeAPIKeyNamespace.mockResolvedValue({ name: 'app-key', prefix: 'new-app', namespaces: ['app'], reservation: 'kept' })
    renderEditor(key())
    await userEvent.click(screen.getByRole('button', { name: 'Remove new-app from app-key' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))
    expect(await screen.findByText(/kept because the namespace exists/)).toBeInTheDocument()
  })

  it('widens with a permission', async () => {
    addAPIKeyNamespace.mockResolvedValue(key())
    renderEditor(key())
    await userEvent.click(screen.getByRole('button', { name: 'Add namespace' }))
    await userEvent.type(screen.getByLabelText('Namespace to add'), 'kb')
    await userEvent.selectOptions(screen.getByLabelText('Access on the added namespace'), 'read')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(addAPIKeyNamespace).toHaveBeenCalledWith('app-key', 'kb', { permission: 'read' }))
    expect(await screen.findByText('Added kb with read.')).toBeInTheDocument()
  })

  it('widens with a reservation, sending only non-default settings', async () => {
    addAPIKeyNamespace.mockResolvedValue(key())
    renderEditor(key())
    await userEvent.click(screen.getByRole('button', { name: 'Add namespace' }))
    await userEvent.type(screen.getByLabelText('Namespace to add'), 'brand-new')
    await userEvent.selectOptions(screen.getByLabelText('Access on the added namespace'), 'reserve')
    await userEvent.selectOptions(screen.getByLabelText('Deletion mode'), 'full')
    expect(screen.getByText(/permanent hard deletes/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(addAPIKeyNamespace).toHaveBeenCalledWith('app-key', 'brand-new', { reserve: { deletion_mode: 'full' } }),
    )
  })

  it('does not offer a reservation for a namespace that exists', async () => {
    renderEditor(key())
    await userEvent.click(screen.getByRole('button', { name: 'Add namespace' }))
    await userEvent.type(screen.getByLabelText('Namespace to add'), 'kb')
    const reserve = screen.getByRole('option', { name: 'reserve (admin)' }) as HTMLOptionElement
    expect(reserve.disabled).toBe(true)
  })

  it('shows the Registry refusal as it comes', async () => {
    addAPIKeyNamespace.mockRejectedValue(new Error("the 'wip' namespace cannot be reserved"))
    renderEditor(key())
    await userEvent.click(screen.getByRole('button', { name: 'Add namespace' }))
    await userEvent.type(screen.getByLabelText('Namespace to add'), 'wip-x')
    await userEvent.selectOptions(screen.getByLabelText('Access on the added namespace'), 'reserve')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText("the 'wip' namespace cannot be reserved")).toBeInTheDocument()
  })
})
