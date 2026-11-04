import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Orphaned grants are listed with what will activate them: Activate is
// offered only where the namespace exists, and a reservation of an absent
// namespace is named without promising that its holder activates the grant.

const listAllGrants = vi.hoisted(() => vi.fn())
const activateGrants = vi.hoisted(() => vi.fn())
const revokeGrants = vi.hoisted(() => vi.fn())
const listReservations = vi.hoisted(() => vi.fn())

vi.mock('@wip/react', () => ({
  useWipClient: () => ({ registry: { listAllGrants, activateGrants, revokeGrants, listReservations } }),
  useNamespaces: () => ({ data: [{ prefix: 'live-ns' }] }),
}))

import OrphanedGrantsPanel from '@/components/grants/OrphanedGrantsPanel'

const orphan = (namespace: string, subject: string) => ({
  namespace, subject, subject_type: 'api_key', permission: 'write', orphaned: true,
  orphaned_at: '2026-11-04T10:00:00Z', granted_by: 'restore', granted_at: '2026-11-04T10:00:00Z', expires_at: null,
})

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={qc}><OrphanedGrantsPanel /></QueryClientProvider>)
}

beforeEach(() => {
  for (const f of [listAllGrants, activateGrants, revokeGrants, listReservations]) f.mockReset()
  listReservations.mockResolvedValue([{ prefix: 'reserved-ns', app: 'holder-key', source: 'runtime', managed_by: null, settings: {}, namespace_exists: false, conflict: null }])
  listAllGrants.mockResolvedValue({ items: [orphan('live-ns', 'k1'), orphan('reserved-ns', 'k2'), orphan('gone-ns', 'k3')] })
})

describe('OrphanedGrantsPanel', () => {
  it('lists orphans with their namespace state', async () => {
    renderPanel()
    const live = await screen.findByTestId('orphan-live-ns-k1')
    expect(live).toHaveTextContent('exists: activate here')
    expect(within(live).getByRole('button', { name: 'Activate k1 on live-ns' })).toBeInTheDocument()

    const reserved = screen.getByTestId('orphan-reserved-ns-k2')
    expect(reserved).toHaveTextContent('reserved by key holder-key, whose creating it will not activate this grant')
    expect(within(reserved).queryByRole('button', { name: /Activate/ })).not.toBeInTheDocument()

    expect(screen.getByTestId('orphan-gone-ns-k3')).toHaveTextContent('activates when a platform admin creates it')
    expect(listAllGrants).toHaveBeenCalledWith({ orphaned: true, page_size: 1000 })
  })

  it('activates on the existing namespace and re-reads the list', async () => {
    activateGrants.mockResolvedValue({ results: [{ index: 0, status: 'activated', subject: 'k1' }] })
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Activate k1 on live-ns' }))
    await waitFor(() => expect(activateGrants).toHaveBeenCalledWith('live-ns', [{ subject: 'k1', subject_type: 'api_key' }]))
    await waitFor(() => expect(listAllGrants).toHaveBeenCalledTimes(2))
  })

  it('shows a per-item refusal', async () => {
    activateGrants.mockResolvedValue({ results: [{ index: 0, status: 'error', subject: 'k1', error: 'Managed by wip-deploy', error_code: 'managed_by_deployer' }] })
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Activate k1 on live-ns' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Managed by wip-deploy')
  })

  it('revokes after a confirmation', async () => {
    revokeGrants.mockResolvedValue({ results: [{ status: 'revoked' }] })
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke k3 on gone-ns' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, revoke' }))
    await waitFor(() => expect(revokeGrants).toHaveBeenCalledWith('gone-ns', [{ subject: 'k3', subject_type: 'api_key' }]))
  })
})
