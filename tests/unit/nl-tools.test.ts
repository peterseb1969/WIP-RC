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
})
