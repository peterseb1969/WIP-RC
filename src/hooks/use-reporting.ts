import { useQuery, useMutation } from '@tanstack/react-query'
import { apiUrl } from '@/lib/wip'

// ---------------------------------------------------------------------------
// Types — matched to actual reporting-sync API responses
// ---------------------------------------------------------------------------

export interface ReportTable {
  name: string
  row_count: number
  column_count: number
}

export interface TableColumns {
  table: string
  columns: Array<{
    name: string
    type: string
  }>
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
  execution_time_ms?: number
}

// SyncStatus is now exported from @wip/client; re-export for callers that
// still import it from this module.
export type { SyncStatus } from '@wip/client'

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(`/wip/api/reporting-sync${path}`), init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`reporting-sync ${path}: HTTP ${res.status} — ${body}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useReportTables() {
  return useQuery({
    queryKey: ['rc-console', 'report-tables'],
    queryFn: () => fetchJson<{ tables: ReportTable[] }>('/tables').then(r => r.tables),
    staleTime: 120_000,
  })
}

/**
 * Get column details for a specific table by running a LIMIT 0 query
 * and inspecting the result columns. The /tables endpoint only returns
 * column_count, not the actual column names/types.
 */
export function useTableColumns(tableName: string | null) {
  return useQuery({
    queryKey: ['rc-console', 'table-columns', tableName],
    queryFn: async (): Promise<TableColumns> => {
      // Use information_schema to get actual column names and types
      const result = await fetchJson<QueryResult>('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`,
        }),
      })
      return {
        table: tableName!,
        columns: result.rows.map(r => ({
          name: String(r.column_name ?? ''),
          type: String(r.data_type ?? ''),
        })),
      }
    },
    enabled: !!tableName,
    staleTime: 300_000,
  })
}

export function useTablePreview(tableName: string | null) {
  return useQuery({
    queryKey: ['rc-console', 'table-preview', tableName],
    queryFn: () =>
      fetchJson<QueryResult>('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: `SELECT * FROM "${tableName}" LIMIT 10` }),
      }),
    enabled: !!tableName,
    staleTime: 30_000,
  })
}

export function useRunQuery() {
  return useMutation({
    mutationFn: async (sql: string): Promise<QueryResult> => {
      const trimmed = sql.trim()
      // Client-side safety: only SELECT allowed
      if (!/^\s*(SELECT|WITH)\b/i.test(trimmed)) {
        throw new Error('Only SELECT queries are allowed')
      }
      return fetchJson<QueryResult>('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: trimmed }),
      })
    },
  })
}

// useSyncStatus is now provided by @wip/react@0.9.0 (CASE-283).
// Import it directly from there:  import { useSyncStatus } from '@wip/react'
// Pass `{ refetchInterval: 60_000 }` if you want polling.
