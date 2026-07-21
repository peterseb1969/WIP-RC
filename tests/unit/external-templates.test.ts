import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Template } from '@wip/client'

// Both sources the hook derives from are mocked — this exercises the
// reconciliation logic (stem matching, mirror-row exclusion, resolution),
// not the network.
const useReportingInventory = vi.fn()
const useTemplates = vi.fn()

vi.mock('@/hooks/use-reporting', () => ({
  useReportingInventory: () => useReportingInventory(),
}))
vi.mock('@wip/react', () => ({
  useTemplates: (params: unknown, options: unknown) => useTemplates(params, options),
}))

const { useExternalTemplates } = await import('@/hooks/use-external-templates')

function tmpl(over: Partial<Template> & { value: string; namespace: string }): Template {
  return {
    template_id: `id-${over.value}`,
    label: over.value,
    version: 1,
    fields: [],
    identity_fields: [],
    header_fields: [],
    ...over,
  } as unknown as Template
}

function entity(namespace: string, name: string, row_count: number) {
  return {
    namespace,
    entity: name,
    default_view: `doc_${name}`,
    default_view_present: true,
    entities_view: `doc_${name}__entities`,
    legacy_table: false,
    versions: [],
    row_count,
  }
}

function table(namespace: string, name: string, template_value: string, row_count: number) {
  return {
    namespace,
    name,
    template_value,
    qualified_name: `"${namespace}"."${name}"`,
    row_count,
    column_count: 5,
    kind: 'view' as const,
  }
}

function inventory(over: { entities?: unknown[]; tables?: unknown[] }) {
  return { data: { entities: over.entities ?? [], tables: over.tables ?? [] }, isLoading: false }
}

beforeEach(() => {
  useReportingInventory.mockReset()
  useTemplates.mockReset()
  useTemplates.mockReturnValue({ data: undefined, isLoading: false })
})

describe('useExternalTemplates', () => {
  it('returns nothing when every reporting stem is an own template', () => {
    useReportingInventory.mockReturnValue(inventory({ entities: [entity('ns-a', 'widget', 3)] }))

    const { result } = renderHook(() =>
      useExternalTemplates('ns-a', [tmpl({ value: 'WIDGET', namespace: 'ns-a' })]),
    )

    expect(result.current.externals).toEqual([])
    expect(result.current.unresolved).toEqual([])
    // The global template list must not be fetched when there is nothing
    // to resolve — that fetch is the expensive part.
    expect(useTemplates).toHaveBeenCalledWith(expect.anything(), { enabled: false })
  })

  it('surfaces a template owned by another namespace', () => {
    useReportingInventory.mockReturnValue(inventory({ entities: [entity('ns-a', 'gadget', 2)] }))
    useTemplates.mockReturnValue({
      data: { items: [tmpl({ value: 'GADGET', namespace: 'ns-b' })] },
      isLoading: false,
    })

    const { result } = renderHook(() => useExternalTemplates('ns-a', []))

    expect(result.current.externals).toHaveLength(1)
    expect(result.current.externals[0]).toMatchObject({
      value: 'GADGET',
      namespace: 'ns-b',
      row_count: 2,
      external: true,
    })
  })

  it('ignores the empty mirror relation created in the template owner namespace', () => {
    // The platform creates a row-less relation for the template in its own
    // namespace; it must not show up there as a browsable external.
    useReportingInventory.mockReturnValue(inventory({ entities: [entity('ns-b', 'gadget', 0)] }))

    const { result } = renderHook(() => useExternalTemplates('ns-b', []))

    expect(result.current.externals).toEqual([])
    expect(useTemplates).toHaveBeenCalledWith(expect.anything(), { enabled: false })
  })

  it('matches a template through its custom reporting table_name', () => {
    useReportingInventory.mockReturnValue(inventory({ entities: [entity('ns-a', 'custom_stem', 1)] }))
    useTemplates.mockReturnValue({
      data: {
        items: [
          tmpl({
            value: 'NOT_THE_STEM',
            namespace: 'ns-b',
            reporting: { table_name: 'doc_custom_stem' },
          } as Partial<Template> & { value: string; namespace: string }),
        ],
      },
      isLoading: false,
    })

    const { result } = renderHook(() => useExternalTemplates('ns-a', []))

    expect(result.current.externals).toHaveLength(1)
    expect(result.current.externals[0]?.value).toBe('NOT_THE_STEM')
    expect(result.current.unresolved).toEqual([])
  })

  it('reports a stem it cannot map back to any template', () => {
    useReportingInventory.mockReturnValue(inventory({ entities: [entity('ns-a', 'ghost', 4)] }))
    useTemplates.mockReturnValue({ data: { items: [] }, isLoading: false })

    const { result } = renderHook(() => useExternalTemplates('ns-a', []))

    expect(result.current.externals).toEqual([])
    expect(result.current.unresolved).toEqual(['ghost'])
  })

  it('falls back to the flat table list on pre-entity installs, skipping version siblings', () => {
    useReportingInventory.mockReturnValue(
      inventory({
        tables: [
          table('ns-a', 'doc_gadget', 'gadget', 2),
          table('ns-a', 'doc_gadget__v1', 'gadget', 2),
          table('ns-a', 'doc_gadget__entities', 'gadget', 2),
        ],
      }),
    )
    useTemplates.mockReturnValue({
      data: { items: [tmpl({ value: 'GADGET', namespace: 'ns-b' })] },
      isLoading: false,
    })

    const { result } = renderHook(() => useExternalTemplates('ns-a', []))

    expect(result.current.externals).toHaveLength(1)
    expect(result.current.externals[0]?.value).toBe('GADGET')
  })

  it('stays inert for the all-namespaces view, which already queries unscoped', () => {
    useReportingInventory.mockReturnValue(inventory({ entities: [entity('ns-a', 'gadget', 2)] }))

    const { result } = renderHook(() => useExternalTemplates('', []))

    expect(result.current.externals).toEqual([])
    expect(useTemplates).toHaveBeenCalledWith(expect.anything(), { enabled: false })
  })

  it('ignores relations belonging to other namespaces', () => {
    useReportingInventory.mockReturnValue(
      inventory({ entities: [entity('ns-other', 'gadget', 9)] }),
    )

    const { result } = renderHook(() => useExternalTemplates('ns-a', []))

    expect(result.current.externals).toEqual([])
  })
})
