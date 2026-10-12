/**
 * Tests for NL query tool definitions — validates tool schema integrity
 * and the SQL safety check in executeTool.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toolDefinitions, executeTool } from '../../server/nl/tools'

describe('toolDefinitions', () => {
  it('defines 7 tools', () => {
    expect(toolDefinitions).toHaveLength(7)
  })

  it('all tools have required fields', () => {
    for (const tool of toolDefinitions) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.input_schema).toBeDefined()
      expect(tool.input_schema.type).toBe('object')
    }
  })

  it('search tool requires query parameter', () => {
    const search = toolDefinitions.find((t) => t.name === 'search')
    expect(search).toBeDefined()
    expect(
      (search!.input_schema as { required?: string[] }).required
    ).toContain('query')
  })

  it('run_report_query tool requires sql parameter', () => {
    const tool = toolDefinitions.find((t) => t.name === 'run_report_query')
    expect(tool).toBeDefined()
    expect(
      (tool!.input_schema as { required?: string[] }).required
    ).toContain('sql')
  })

  it('get_document tool requires document_id', () => {
    const tool = toolDefinitions.find((t) => t.name === 'get_document')
    expect(tool).toBeDefined()
    expect(
      (tool!.input_schema as { required?: string[] }).required
    ).toContain('document_id')
  })

  it('describe_data_model and list_report_tables have no required params', () => {
    for (const name of ['describe_data_model', 'list_report_tables']) {
      const tool = toolDefinitions.find((t) => t.name === name)
      expect(tool).toBeDefined()
      const required = (tool!.input_schema as { required?: string[] }).required
      expect(!required || required.length === 0).toBe(true)
    }
  })

  const toolNames = toolDefinitions.map((t) => t.name)
  it('has no duplicate tool names', () => {
    const unique = new Set(toolNames)
    expect(unique.size).toBe(toolNames.length)
  })
})

describe('executeTool — SQL safety', () => {
  // We mock fetch globally to avoid actual WIP calls
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  it('rejects INSERT queries', async () => {
    const result = await executeTool('run_report_query', {
      sql: 'INSERT INTO foo VALUES (1)',
    })
    expect(result).toEqual({ error: 'Only SELECT queries are allowed.' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects DELETE queries', async () => {
    const result = await executeTool('run_report_query', {
      sql: 'DELETE FROM foo',
    })
    expect(result).toEqual({ error: 'Only SELECT queries are allowed.' })
  })

  it('rejects UPDATE queries', async () => {
    const result = await executeTool('run_report_query', {
      sql: 'UPDATE foo SET bar = 1',
    })
    expect(result).toEqual({ error: 'Only SELECT queries are allowed.' })
  })

  it('rejects DROP queries', async () => {
    const result = await executeTool('run_report_query', {
      sql: 'DROP TABLE foo',
    })
    expect(result).toEqual({ error: 'Only SELECT queries are allowed.' })
  })

  it('allows SELECT queries', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
    })

    await executeTool('run_report_query', {
      sql: 'SELECT count(*) FROM doc_person',
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('allows WITH (CTE) queries', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
    })

    await executeTool('run_report_query', {
      sql: 'WITH cte AS (SELECT 1) SELECT * FROM cte',
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('forwards namespace into the query body (CASE-628 per-namespace schemas)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
    })

    await executeTool('run_report_query', {
      sql: 'SELECT count(*) FROM doc_person',
      namespace: 'clintrial',
    })

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string)
    expect(body).toEqual({ sql: 'SELECT count(*) FROM doc_person', namespace: 'clintrial' })
  })

  it('omits namespace from the body when not provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
    })

    await executeTool('run_report_query', {
      sql: 'SELECT count(*) FROM "wip"."doc_namespaces"',
    })

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string)
    expect(body).toEqual({ sql: 'SELECT count(*) FROM "wip"."doc_namespaces"' })
  })

  it('returns error for unknown tool', async () => {
    const result = await executeTool('nonexistent_tool', {})
    expect(result).toEqual({ error: 'Unknown tool: nonexistent_tool' })
  })
})

describe('executeTool — list_terms', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  it('requires either terminology_id or terminology_value', async () => {
    const result = await executeTool('list_terms', {})
    expect(result).toEqual({
      error: 'Provide either terminology_id or terminology_value',
    })
  })

  it('fetches by terminology_id when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ terms: [] }),
    })

    await executeTool('list_terms', { terminology_id: 'T-001' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = mockFetch.mock.calls[0]![0] as string
    expect(url).toContain('/terminologies/T-001/terms')
  })

  it('resolves terminology_value through the list endpoint\'s items/terminology_id', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [{ terminology_id: 'tid-1', value: 'SHAPES' }], total: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [], total: 0 }),
      })

    await executeTool('list_terms', { terminology_value: 'SHAPES', namespace: 'dev' })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[0]![0]).toContain('/terminologies?value=SHAPES&namespace=dev')
    expect(mockFetch.mock.calls[1]![0]).toContain('/terminologies/tid-1/terms?page_size=1000')
  })

  it('reports not found when the lookup returns no items', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: [], total: 0 }),
    })
    const result = await executeTool('list_terms', { terminology_value: 'NOPE' })
    expect(result).toEqual({ error: 'Terminology "NOPE" not found' })
  })
})

describe('executeTool — query_by_template', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [] }) })
  })

  it('sends the documents/query wire shape with namespace as a query param', async () => {
    await executeTool('query_by_template', {
      template_value: 'PERSON',
      namespace: 'hr',
      filters: { status: 'ACTIVE', 'data.city': 'Bern' },
      limit: 5,
      page: 2,
    })
    const [url, init] = mockFetch.mock.calls[0]!
    expect(url).toContain('/api/document-store/documents/query?namespace=hr')
    expect(JSON.parse(init.body as string)).toEqual({
      template_id: 'PERSON',
      filters: [
        { field: 'data.status', operator: 'eq', value: 'ACTIVE' },
        { field: 'data.city', operator: 'eq', value: 'Bern' },
      ],
      page: 2,
      page_size: 5,
    })
  })

  it('defaults to page 1 / 20 per page and caps page_size at 100', async () => {
    await executeTool('query_by_template', { template_value: 'PERSON', namespace: 'hr', limit: 500 })
    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string)
    expect(body).toMatchObject({ filters: [], page: 1, page_size: 100 })

    await executeTool('query_by_template', { template_value: 'PERSON', namespace: 'hr' })
    const body2 = JSON.parse(mockFetch.mock.calls[1]![1]!.body as string)
    expect(body2).toMatchObject({ page: 1, page_size: 20 })
  })
})

describe('executeTool — describe_data_model', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  it('reads list items and maps template_id / terminology_id', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.includes('/template-store/')
              ? { items: [{ template_id: 'tpl-1', value: 'PERSON', namespace: 'hr', version: 3, fields: [{}, {}], identity_fields: ['email'] }] }
              : { items: [{ terminology_id: 'trm-1', value: 'COUNTRY', namespace: 'wip', term_count: 250 }] },
          ),
      }),
    )

    const result = (await executeTool('describe_data_model', {})) as {
      templates: Array<Record<string, unknown>>
      terminologies: Array<Record<string, unknown>>
    }
    const urls = mockFetch.mock.calls.map((c) => c[0] as string)
    expect(urls.some((u) => u.includes('latest_only=true') && u.includes('page_size=1000'))).toBe(true)
    expect(result.templates).toEqual([
      expect.objectContaining({ id: 'tpl-1', value: 'PERSON', namespace: 'hr', field_count: 2 }),
    ])
    expect(result.terminologies).toEqual([
      expect.objectContaining({ id: 'trm-1', value: 'COUNTRY', term_count: 250 }),
    ])
  })
})
