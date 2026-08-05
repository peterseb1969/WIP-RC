import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { Template } from '@wip/client'

// The hook reconciles two sources: GET /documents/template-facets (which
// templates this namespace's documents actually use) and the global template
// list (their definitions). Both are mocked — what is under test is the
// reconciliation, not the network.
const getTemplateFacets = vi.fn()
const useTemplates = vi.fn()

vi.mock('@wip/react', () => ({
  useWipClient: () => ({ documents: { getTemplateFacets } }),
  useTemplates: (params: unknown, options: unknown) => useTemplates(params, options),
}))

const { useExternalTemplates } = await import('@/hooks/use-external-templates')

// A real QueryClientProvider, so the facet query behaves like it does in the
// app (enabled/disabled, caching) rather than being stubbed away.
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
const React = await import('react')

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

function tmpl(over: Partial<Template> & { value: string; namespace: string; template_id: string }): Template {
  return { label: over.value, version: 1, fields: [], identity_fields: [], header_fields: [], ...over } as unknown as Template
}

function facet(over: { template_id: string; template_value?: string | null; template_namespace: string | null; document_count?: number }) {
  return {
    template_id: over.template_id,
    template_value: over.template_value ?? over.template_id.toUpperCase(),
    template_namespace: over.template_namespace,
    document_count: over.document_count ?? 1,
  }
}

beforeEach(() => {
  getTemplateFacets.mockReset()
  useTemplates.mockReset()
  useTemplates.mockReturnValue({ data: undefined, isLoading: false })
})

describe('useExternalTemplates', () => {
  it('returns nothing when every facet is an own template', async () => {
    getTemplateFacets.mockResolvedValue({
      namespace: 'ns-a',
      facets: [facet({ template_id: 't-widget', template_namespace: 'ns-a' })],
    })

    const { result } = renderHook(
      () => useExternalTemplates('ns-a', [tmpl({ template_id: 't-widget', value: 'WIDGET', namespace: 'ns-a' })]),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.externals).toEqual([])
    // The global template list is the expensive call — it must stay off when
    // there is nothing foreign to resolve.
    expect(useTemplates).toHaveBeenLastCalledWith(expect.anything(), { enabled: false })
  })

  it('surfaces a template owned by another namespace, with its live count', async () => {
    getTemplateFacets.mockResolvedValue({
      namespace: 'ns-a',
      facets: [facet({ template_id: 't-gadget', template_namespace: 'ns-b', document_count: 42 })],
    })
    useTemplates.mockReturnValue({
      data: { items: [tmpl({ template_id: 't-gadget', value: 'GADGET', namespace: 'ns-b' })] },
      isLoading: false,
    })

    const { result } = renderHook(() => useExternalTemplates('ns-a', []), { wrapper })

    await waitFor(() => expect(result.current.externals).toHaveLength(1))
    expect(result.current.externals[0]).toMatchObject({
      value: 'GADGET',
      namespace: 'ns-b',
      document_count: 42,
      external: true,
    })
  })

  it('treats an unfetchable template namespace as foreign rather than hiding it', async () => {
    getTemplateFacets.mockResolvedValue({
      namespace: 'ns-a',
      facets: [facet({ template_id: 't-ghost', template_value: 'GHOST', template_namespace: null })],
    })
    useTemplates.mockReturnValue({ data: { items: [] }, isLoading: false })

    const { result } = renderHook(() => useExternalTemplates('ns-a', []), { wrapper })

    await waitFor(() => expect(result.current.unresolved).toEqual(['GHOST']))
    expect(result.current.externals).toEqual([])
  })

  it('reports a facet whose template definition no longer exists', async () => {
    getTemplateFacets.mockResolvedValue({
      namespace: 'ns-a',
      facets: [facet({ template_id: 't-deleted', template_value: 'DELETED', template_namespace: 'ns-b' })],
    })
    useTemplates.mockReturnValue({ data: { items: [] }, isLoading: false })

    const { result } = renderHook(() => useExternalTemplates('ns-a', []), { wrapper })

    await waitFor(() => expect(result.current.unresolved).toEqual(['DELETED']))
  })

  it('does not re-list an own template that the facets also report', async () => {
    // Belt and braces: the namespace check should already exclude it, but a
    // template_id match must win regardless of what namespace the facet claims.
    getTemplateFacets.mockResolvedValue({
      namespace: 'ns-a',
      facets: [facet({ template_id: 't-widget', template_namespace: 'ns-somewhere-else' })],
    })

    const { result } = renderHook(
      () => useExternalTemplates('ns-a', [tmpl({ template_id: 't-widget', value: 'WIDGET', namespace: 'ns-a' })]),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.externals).toEqual([])
  })

  it('stays inert for the all-namespaces view, which already queries unscoped', async () => {
    const { result } = renderHook(() => useExternalTemplates('', []), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.externals).toEqual([])
    expect(getTemplateFacets).not.toHaveBeenCalled()
  })

  it('sorts externals by value for a stable dropdown', async () => {
    getTemplateFacets.mockResolvedValue({
      namespace: 'ns-a',
      facets: [
        facet({ template_id: 't-z', template_namespace: 'ns-b' }),
        facet({ template_id: 't-a', template_namespace: 'ns-b' }),
      ],
    })
    useTemplates.mockReturnValue({
      data: {
        items: [
          tmpl({ template_id: 't-z', value: 'ZEBRA', namespace: 'ns-b' }),
          tmpl({ template_id: 't-a', value: 'APPLE', namespace: 'ns-b' }),
        ],
      },
      isLoading: false,
    })

    const { result } = renderHook(() => useExternalTemplates('ns-a', []), { wrapper })

    await waitFor(() => expect(result.current.externals).toHaveLength(2))
    expect(result.current.externals.map(e => e.value)).toEqual(['APPLE', 'ZEBRA'])
  })
})
