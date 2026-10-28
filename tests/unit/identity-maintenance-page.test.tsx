import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RehashIdentitiesItem, RehashIdentitiesResponse } from '@wip/client'

// The page's job is to keep a preview and an apply apart: Apply is only offered
// for a current preview that found changes, "rows rewritten" is never presented
// as "re-keyed", and a failed Registry re-key is called out. The network
// (client calls) is mocked; what is under test is what the operator sees.

const rehashIdentities = vi.hoisted(() => vi.fn())
const getTemplateFacets = vi.hoisted(() => vi.fn())

vi.mock('@/lib/wip', () => ({
  maintenanceClient: { documents: { rehashIdentities } },
  basePath: '',
  apiUrl: (p: string) => p,
}))

vi.mock('@wip/react', () => ({
  useWipClient: () => ({ documents: { getTemplateFacets } }),
  useNamespaces: () => ({
    data: [
      { prefix: 'ns-a', status: 'active' },
      { prefix: 'ns-b', status: 'active' },
      { prefix: 'gone', status: 'deleted' },
    ],
  }),
  useTemplates: () => ({
    data: {
      items: [
        { template_id: 't-1', value: 'PATIENT', label: 'Patient record' },
        { template_id: 't-2', value: 'VISIT', label: 'VISIT' },
        { template_id: 't-3', value: 'OTHER', label: 'Other' },
      ],
    },
  }),
  wipKeys: {
    documents: { all: ['wip', 'documents'] },
    registry: { all: ['wip', 'registry'] },
  },
}))

vi.mock('@/hooks/use-namespace-filter', () => ({
  useNamespaceFilter: () => ({ namespace: '' }),
}))

import IdentityMaintenancePage from '@/pages/IdentityMaintenancePage'

function item(over: Partial<RehashIdentitiesItem> = {}): RehashIdentitiesItem {
  return {
    document_id: 'doc-1',
    template_id: 't-1',
    template_value: 'PATIENT',
    status: 'changed',
    old_hash: 'aaaaaaaaaaaaaaaa',
    new_hash: 'bbbbbbbbbbbbbbbb',
    detail: null,
    versions_updated: 0,
    registry_status: null,
    ...over,
  }
}

function response(over: Partial<RehashIdentitiesResponse> = {}): RehashIdentitiesResponse {
  return {
    namespace: 'ns-a',
    dry_run: true,
    scanned: 10,
    changed: 3,
    unchanged: 7,
    unresolved: 0,
    collisions: 0,
    errors: 0,
    applied: 0,
    items: [item()],
    collision_groups: [],
    reporting_note: 'Replay the affected templates to refresh reporting.',
    ...over,
  }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <IdentityMaintenancePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function pickNamespace(user: ReturnType<typeof userEvent.setup>, ns = 'ns-a') {
  await user.selectOptions(screen.getByLabelText(/namespace/i), ns)
}

beforeEach(() => {
  rehashIdentities.mockReset()
  getTemplateFacets.mockReset()
  getTemplateFacets.mockResolvedValue({
    namespace: 'ns-a',
    facets: [
      { template_id: 't-1', template_value: 'PATIENT', template_namespace: 'ns-a', document_count: 5 },
      { template_id: 't-2', template_value: 'VISIT', template_namespace: 'ns-a', document_count: 5 },
    ],
  })
})

describe('IdentityMaintenancePage', () => {
  it('offers only live namespaces and starts with Preview disabled until one is picked', async () => {
    const user = userEvent.setup()
    renderPage()
    const select = screen.getByLabelText(/namespace/i)
    expect(within(select).queryByRole('option', { name: 'gone' })).toBeNull()
    expect(screen.getByRole('button', { name: /preview/i })).toBeDisabled()
    await pickNamespace(user)
    expect(screen.getByRole('button', { name: /preview/i })).toBeEnabled()
  })

  it('lists the templates the namespace uses, labelled with label and value', async () => {
    const user = userEvent.setup()
    renderPage()
    await pickNamespace(user)
    expect(await screen.findByLabelText('Patient record (PATIENT)')).toBeInTheDocument()
    expect(screen.getByLabelText('VISIT')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Other/)).toBeNull()
  })

  it('previews with dry_run true and passes the template filter only when chosen', async () => {
    const user = userEvent.setup()
    rehashIdentities.mockResolvedValue(response())
    renderPage()
    await pickNamespace(user)
    await user.click(screen.getByRole('button', { name: /preview/i }))
    await screen.findByText('Would change')
    expect(rehashIdentities).toHaveBeenLastCalledWith({ namespace: 'ns-a', dry_run: true })

    await user.click(await screen.findByLabelText('Patient record (PATIENT)'))
    await user.click(screen.getByRole('button', { name: /preview/i }))
    await waitFor(() => expect(rehashIdentities).toHaveBeenCalledTimes(2))
    expect(rehashIdentities).toHaveBeenLastCalledWith({ namespace: 'ns-a', dry_run: true, template_values: ['PATIENT'] })
  })

  it('offers Apply for a current preview with changes, behind a confirmation that names the limits', async () => {
    const user = userEvent.setup()
    rehashIdentities.mockResolvedValue(response())
    renderPage()
    await pickNamespace(user)
    await user.click(screen.getByRole('button', { name: /preview/i }))
    const apply = await screen.findByRole('button', { name: /apply to 3 documents/i })
    expect(apply).toBeEnabled()

    await user.click(apply)
    expect(screen.getByText(/left unchanged/i)).toBeInTheDocument()
    expect(screen.getByText(/does not retry a failed registry re-key/i)).toBeInTheDocument()
    expect(rehashIdentities).toHaveBeenCalledTimes(1)
  })

  it('disables Apply when the preview found nothing to change', async () => {
    const user = userEvent.setup()
    rehashIdentities.mockResolvedValue(response({ changed: 0, unchanged: 10, items: [] }))
    renderPage()
    await pickNamespace(user)
    await user.click(screen.getByRole('button', { name: /preview/i }))
    expect(await screen.findByRole('button', { name: /apply to 0 documents/i })).toBeDisabled()
    expect(screen.getByText(/found nothing to change/i)).toBeInTheDocument()
  })

  it('disables Apply once the template filter no longer matches the preview', async () => {
    const user = userEvent.setup()
    rehashIdentities.mockResolvedValue(response())
    renderPage()
    await pickNamespace(user)
    await user.click(screen.getByRole('button', { name: /preview/i }))
    expect(await screen.findByRole('button', { name: /apply to 3 documents/i })).toBeEnabled()

    await user.click(await screen.findByLabelText('Patient record (PATIENT)'))
    expect(screen.getByRole('button', { name: /apply to 3 documents/i })).toBeDisabled()
    expect(screen.getByText(/changed since the preview/i)).toBeInTheDocument()
  })

  it('reports collisions as report-only', async () => {
    const user = userEvent.setup()
    rehashIdentities.mockResolvedValue(
      response({
        collisions: 2,
        collision_groups: [{ template_id: 't-1', identity_hash: 'cccccccccccccccc', document_ids: ['d1', 'd2'] }],
        items: [item({ document_id: 'd1', status: 'collision' }), item({ document_id: 'd2', status: 'collision' })],
      }),
    )
    renderPage()
    await pickNamespace(user)
    await user.click(screen.getByRole('button', { name: /preview/i }))
    expect(await screen.findByText(/same identity/i)).toBeInTheDocument()
    expect(screen.getByText(/only reported, never applied/i)).toBeInTheDocument()
    expect(screen.getByText(/d1, d2/)).toBeInTheDocument()
  })

  it('applies the previewed scope with dry_run false and shows rows rewritten apart from the Registry outcome', async () => {
    const user = userEvent.setup()
    rehashIdentities.mockResolvedValueOnce(response())
    rehashIdentities.mockResolvedValueOnce(
      response({
        dry_run: false,
        applied: 3,
        items: [
          item({ document_id: 'd1', registry_status: 'rekeyed' }),
          item({ document_id: 'd2', registry_status: 'rekeyed' }),
          item({ document_id: 'd3', registry_status: 'error: boom' }),
        ],
      }),
    )
    renderPage()
    await pickNamespace(user)
    await user.click(screen.getByRole('button', { name: /preview/i }))
    await user.click(await screen.findByRole('button', { name: /apply to 3 documents/i }))
    await user.click(screen.getByRole('button', { name: /apply rehash/i }))

    expect(await screen.findByText(/3 documents rewritten in ns-a/i)).toBeInTheDocument()
    expect(rehashIdentities).toHaveBeenLastCalledWith({ namespace: 'ns-a', dry_run: false })

    // The failure is called out, the counts are per status as returned, and the
    // platform's reporting note is shown as it came.
    expect(screen.getByRole('alert')).toHaveTextContent(/re-key failed for 1 document/i)
    expect(screen.getByText('rekeyed: 2')).toBeInTheDocument()
    expect(screen.getByText('error: boom: 1')).toBeInTheDocument()
    expect(screen.getByText('Replay the affected templates to refresh reporting.')).toBeInTheDocument()

    // No way to run it again from the result: the preview is gone, Apply with it.
    expect(screen.queryByRole('button', { name: /apply to/i })).toBeNull()
  })

  it('calls out a Registry conflict as a failed re-key', async () => {
    // The Registry answers conflict when the new identity key is already held by
    // another entry; that is a failed re-key, not a neutral status.
    const user = userEvent.setup()
    rehashIdentities.mockResolvedValueOnce(response())
    rehashIdentities.mockResolvedValueOnce(
      response({
        dry_run: false,
        applied: 3,
        items: [
          item({ document_id: 'd1', registry_status: 'rekeyed' }),
          item({ document_id: 'd2', registry_status: 'conflict' }),
          item({ document_id: 'd3', registry_status: 'not_found' }),
        ],
      }),
    )
    renderPage()
    await pickNamespace(user)
    await user.click(screen.getByRole('button', { name: /preview/i }))
    await user.click(await screen.findByRole('button', { name: /apply to 3 documents/i }))
    await user.click(screen.getByRole('button', { name: /apply rehash/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/re-key failed for 2 documents/i)
  })

  it('says the pass may have finished when an apply request fails', async () => {
    const user = userEvent.setup()
    rehashIdentities.mockResolvedValueOnce(response())
    rehashIdentities.mockRejectedValueOnce(new Error('Request timed out after 300000ms'))
    renderPage()
    await pickNamespace(user)
    await user.click(screen.getByRole('button', { name: /preview/i }))
    await user.click(await screen.findByRole('button', { name: /apply to 3 documents/i }))
    await user.click(screen.getByRole('button', { name: /apply rehash/i }))

    expect(await screen.findByText(/apply failed: request timed out/i)).toBeInTheDocument()
    expect(screen.getByText(/may have finished on the server/i)).toBeInTheDocument()
  })

  it('shows a failed preview as an error', async () => {
    const user = userEvent.setup()
    rehashIdentities.mockRejectedValueOnce(new Error('403 forbidden'))
    renderPage()
    await pickNamespace(user)
    await user.click(screen.getByRole('button', { name: /preview/i }))
    expect(await screen.findByText(/preview failed: 403 forbidden/i)).toBeInTheDocument()
  })
})
