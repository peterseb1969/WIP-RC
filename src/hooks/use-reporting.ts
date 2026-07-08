import { useQuery, useMutation } from '@tanstack/react-query'
import { apiUrl } from '@/lib/wip'

// ---------------------------------------------------------------------------
// Types — matched to actual reporting-sync API responses
// ---------------------------------------------------------------------------

export interface ReportTable {
  // Since CASE-628, reporting tables live in one PG schema per namespace;
  // (namespace, name) identifies a table, and the same name can exist in
  // several namespaces. qualified_name is the server-provided, ready-quoted
  // `"<namespace>"."<name>"` form for use in SQL.
  namespace: string
  name: string
  template_value: string
  qualified_name: string
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
 * Get column details for a specific table by querying information_schema.
 * The /tables endpoint only returns column_count, not names/types. The
 * table_schema filter is load-bearing: without it, tables sharing a name
 * across namespaces would merge their column lists.
 */
export function useTableColumns(table: ReportTable | null) {
  return useQuery({
    queryKey: ['rc-console', 'table-columns', table?.namespace, table?.name],
    queryFn: async (): Promise<TableColumns> => {
      const result = await fetchJson<QueryResult>('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = '${table!.namespace}' AND table_name = '${table!.name}' ORDER BY ordinal_position`,
        }),
      })
      return {
        table: table!.name,
        columns: result.rows.map(r => ({
          name: String(r.column_name ?? ''),
          type: String(r.data_type ?? ''),
        })),
      }
    },
    enabled: !!table,
    staleTime: 300_000,
  })
}

export function useTablePreview(table: ReportTable | null) {
  return useQuery({
    queryKey: ['rc-console', 'table-preview', table?.namespace, table?.name],
    queryFn: () =>
      fetchJson<QueryResult>('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: `SELECT * FROM ${table!.qualified_name} LIMIT 10` }),
      }),
    enabled: !!table,
    staleTime: 30_000,
  })
}

export interface RunQueryInput {
  sql: string
  /** When set, the server resolves unqualified doc_* names in this
   *  namespace's schema (search_path). Omit for schema-qualified SQL. */
  namespace?: string
}

export function useRunQuery() {
  return useMutation({
    mutationFn: async ({ sql, namespace }: RunQueryInput): Promise<QueryResult> => {
      const trimmed = sql.trim()
      // Client-side safety: only SELECT allowed
      if (!/^\s*(SELECT|WITH)\b/i.test(trimmed)) {
        throw new Error('Only SELECT queries are allowed')
      }
      return fetchJson<QueryResult>('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(namespace ? { sql: trimmed, namespace } : { sql: trimmed }),
      })
    },
  })
}

// useSyncStatus is now provided by @wip/react@0.9.0 (CASE-283).
// Import it directly from there:  import { useSyncStatus } from '@wip/react'
// Pass `{ refetchInterval: 60_000 }` if you want polling.
