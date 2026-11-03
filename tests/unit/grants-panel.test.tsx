import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Grants wip-deploy owns are listed but can't be revoked, a grant to a key
// whose grants the key file declares isn't offered, and a refusal the
// Registry returns as an error item in a 200 is shown, not taken as success.

const listGrants = vi.hoisted(() => vi.fn())
const createGrants = vi.hoisted(() => vi.fn())
const revokeGrants = vi.hoisted(() => vi.fn())
const listAPIKeys = vi.hoisted(() => vi.fn())

vi.mock('@wip/react', () => ({
  useWipClient: () => ({ registry: { listGrants, createGrants, revokeGrants, listAPIKeys } }),
}))

import GrantsPanel from '@/components/grants/GrantsPanel'

const grant = (over: Record<string, unknown>) => ({
  namespace: 'kb', subject: 'x', subject_type: 'api_key', permission: 'read',
  granted_by: 'ops', granted_at: '2026-11-03T10:00:00Z', expires_at: null, ...over,
})

async function openPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={qc}><GrantsPanel prefix="kb" /></QueryClientProvider>)
  await userEvent.click(screen.getByText(/Grants/))
}

beforeEach(() => {
  for (const f of [listGrants, createGrants, revokeGrants, listAPIKeys]) f.mockReset()
  listAPIKeys.mockResolvedValue({ items: [
    { name: 'app-wip-kb', source: 'config', managed_by: 'wip-deploy', grants: { kb: 'admin' }, namespaces: ['kb'] },
    { name: 'app-free', source: 'config', managed_by: 'wip-deploy', grants: null, namespaces: ['kb'] },
  ] })
})

describe('GrantsPanel', () => {
  it('shows a wip-deploy grant without a revoke button', async () => {
    listGrants.mockResolvedValue([
      grant({ subject: 'app-wip-kb', permission: 'admin', managed_by: 'wip-deploy' }),
      grant({ subject: 'console-key', permission: 'write', managed_by: null }),
    ])
    await openPanel()
    expect(await screen.findByText('app-wip-kb')).toBeInTheDocument()
    expect(screen.getByText('wip-deploy')).toBeInTheDocument()
    expect(screen.getAllByTitle('Revoke grant')).toHaveLength(1)
  })

  it('shows a revoke refused as an error item instead of treating it as done', async () => {
    listGrants.mockResolvedValue([grant({ subject: 'console-key', permission: 'write' })])
    revokeGrants.mockResolvedValue({ results: [{ status: 'error', error: 'Managed by wip-deploy', error_code: 'managed_by_deployer' }] })
    await openPanel()
    await userEvent.click(await screen.findByTitle('Revoke grant'))
    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    expect(await screen.findByText('Managed by wip-deploy')).toBeInTheDocument()
    // The refusal re-reads the grants, so a grant that turned managed shows as such.
    await waitFor(() => expect(listGrants).toHaveBeenCalledTimes(2))
  })

  it('does not offer a grant to a key whose grants the key file declares', async () => {
    listGrants.mockResolvedValue([])
    await openPanel()
    await userEvent.click(await screen.findByRole('button', { name: /Add grant/ }))
    const subject = screen.getByPlaceholderText('key name')
    await userEvent.type(subject, 'app-wip-kb')
    expect(await screen.findByRole('alert')).toHaveTextContent("app-wip-kb's grants are declared in the install's key file")
    expect(screen.getByRole('button', { name: 'Grant' })).toBeDisabled()

    // A wip-deploy key that declares no grants keeps console grants.
    await userEvent.clear(subject)
    await userEvent.type(subject, 'app-free')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Grant' })).toBeEnabled()
  })
})
