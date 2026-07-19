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
  // CASE-710: absent on pre-split installs — its presence doubles as the
  // detection signal for the entity-first reporting layout.
  kind?: 'view' | 'table'
}

// CASE-710 entity-first grouping: one entry per (namespace, template),
// owning its per-version physical tables and derived views. The entity
// row_count is the document count — never sum sibling relations, they
// overlap by construction.
export interface ReportEntity {
  namespace: string
  entity: string
  default_view: string
  default_view_present: boolean
  entities_view: string
  legacy_table: boolean
  versions: Array<{ version: number; table: string; row_count: number }>
  row_count: number
}

export interface ReportingInventory {
  tables: ReportTable[]
  // Empty on pre-CASE-710 installs — callers fall back to the flat list.
  entities: ReportEntity[]
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

const fetchInventory = () =>
  fetchJson<{ tables: ReportTable[]; entities?: ReportEntity[] }>('/tables')
    .then(r => ({ tables: r.tables, entities: r.entities ?? [] }) as ReportingInventory)

export function useReportingInventory() {
  return useQuery({
    queryKey: ['rc-console', 'report-tables'],
    queryFn: fetchInventory,
    staleTime: 120_000,
  })
}

export function useReportTables() {
  return useQuery({
    queryKey: ['rc-console', 'report-tables'],
    queryFn: fetchInventory,
    select: (inv: ReportingInventory) => inv.tables,
    staleTime: 120_000,
  })
}

// ---------------------------------------------------------------------------
// Parity (CASE-710 fields: version_tables / view_present / legacy_table)
// ---------------------------------------------------------------------------

export interface ParityTemplate {
  template_value: string
  sync_enabled: boolean
  table_present: boolean
  missing_columns: string[]
  bookkeeping_row: boolean
  counts_comparable: boolean
  expected_documents: number
  actual_rows: number
  counts_match: boolean
  error: string | null
  version_tables?: number[]
  view_present?: boolean
  legacy_table?: boolean
}

export interface NamespaceParity {
  namespace: string
  schema_name: string
  schema_present: boolean
  table_count: number
  bookkeeping_tables_ok: boolean
  bookkeeping_error: string | null
  templates_skipped_sync_disabled: number
  structural_issues: number
  count_mismatches: number
  ok: boolean
  templates: ParityTemplate[]
}

export const fetchNamespaceParity = (namespace: string) =>
  fetchJson<NamespaceParity>(`/parity?namespace=${encodeURIComponent(namespace)}`)

export const PARITY_QUERY_KEY = (namespace: string) =>
  ['rc-console', 'parity', namespace] as const

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
