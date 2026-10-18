import { useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useWipClient } from '@wip/react'
import type { ReportQueryResult, ReportTable, ReportEntity, WipClient } from '@wip/client'
import { apiUrl } from '@/lib/wip'

// ---------------------------------------------------------------------------
// Types — matched to actual reporting-sync API responses
// ---------------------------------------------------------------------------

// Table and entity shapes come from @wip/client, which owns the /tables
// contract: tables are identified by (namespace, name), `qualified_name` is the
// server-quoted `"<namespace>"."<name>"`, `template_value` is null for metadata
// tables, and entities group a template's per-version tables and views (their
// row_count is the document count — never sum sibling relations).
export type { ReportTable, ReportEntity } from '@wip/client'

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

/** A `/query` result: rows keyed by column name; columns present even for an empty result. */
export type QueryResult = ReportQueryResult

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

const fetchInventory = (client: WipClient): Promise<ReportingInventory> =>
  client.reporting.listTables().then(r => ({ tables: r.tables, entities: r.entities ?? [] }))

/**
 * The reporting layer's inventory (`client.reporting.listTables()`, reporting-sync `/tables`): every table/view
 * per namespace schema, plus the per-template entity grouping (empty on installs
 * that predate it). Registered views are not part of this inventory.
 */
export function useReportingInventory() {
  const client = useWipClient()
  return useQuery({
    queryKey: ['rc-console', 'report-tables'],
    queryFn: () => fetchInventory(client),
    staleTime: 120_000,
  })
}

/**
 * The flat table list of the reporting inventory. Shares the inventory's cache
 * entry, so the Table Browser and Query Pad trigger one `/tables` fetch between them.
 */
export function useReportTables() {
  const client = useWipClient()
  return useQuery({
    queryKey: ['rc-console', 'report-tables'],
    queryFn: () => fetchInventory(client),
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
  expected_documents: number | null
  actual_rows: number | null
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

/**
 * One namespace's reporting parity report (reporting-sync `/parity`): schema and
 * bookkeeping health plus per-template table/count checks against the document store.
 */
export const fetchNamespaceParity = (namespace: string) =>
  fetchJson<NamespaceParity>(`/parity?namespace=${encodeURIComponent(namespace)}`)

/** Query key for a namespace's parity report — shared so the panel can fan out with useQueries. */
export const PARITY_QUERY_KEY = (namespace: string) =>
  ['rc-console', 'parity', namespace] as const

/**
 * Runs a read-only statement through reporting-sync `/query` via the typed
 * client. With `namespace`, unqualified names (doc_*, terms, registered views)
 * resolve in that namespace's schema; without it, names must be qualified.
 */
function runReportQuery(
  client: WipClient,
  sql: string,
  namespace?: string,
  params: unknown[] = [],
): Promise<QueryResult> {
  return client.reporting.runQuery(sql, params, namespace ? { namespace } : undefined)
}

/**
 * Column names and types of one reporting table or view, from the inventory's
 * detail mode (`listTables(name, namespace)`). Lookup is by (namespace, name),
 * since the same name exists in several namespaces.
 */
export function useTableColumns(table: ReportTable | null) {
  const client = useWipClient()
  return useQuery({
    queryKey: ['rc-console', 'table-columns', table?.namespace, table?.name],
    queryFn: async (): Promise<TableColumns> => {
      const { tables } = await client.reporting.listTables(table!.name, table!.namespace)
      const detail = tables.find(t => t.namespace === table!.namespace && t.name === table!.name)
      return {
        table: table!.name,
        columns: (detail?.columns ?? []).map(c => ({ name: c.name, type: c.type })),
      }
    },
    enabled: !!table,
    staleTime: 300_000,
  })
}

/**
 * First 10 rows of a reporting table or view, read with its server-quoted
 * qualified name.
 */
export function useTablePreview(table: ReportTable | null) {
  const client = useWipClient()
  return useQuery({
    queryKey: ['rc-console', 'table-preview', table?.namespace, table?.name],
    queryFn: () => runReportQuery(client, `SELECT * FROM ${table!.qualified_name} LIMIT 10`),
    enabled: !!table,
    staleTime: 30_000,
  })
}

// Server-paginated page of a reporting table (CASE-812 follow-up: parity with
// the document Table View). qualified_name is already `"ns"."name"`-quoted;
// page/pageSize are numbers, so the interpolation is injection-safe. Total row
// count comes from the inventory (table.row_count), so no extra COUNT query.
export function useTablePage(table: ReportTable | null, page: number, pageSize: number) {
  const client = useWipClient()
  return useQuery({
    queryKey: ['rc-console', 'table-page', table?.namespace, table?.name, page, pageSize],
    queryFn: () =>
      runReportQuery(
        client,
        `SELECT * FROM ${table!.qualified_name} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      ),
    enabled: !!table,
    staleTime: 30_000,
    // Keep the previous page on screen while the next one loads (smoother paging).
    placeholderData: previous => previous,
  })
}

export interface RunQueryInput {
  sql: string
  /** When set, the server resolves unqualified doc_* names in this
   *  namespace's schema (search_path). Omit for schema-qualified SQL. */
  namespace?: string
}

/**
 * Runs ad-hoc SQL against reporting-sync `/query` (Query Pad, view tests). With
 * `namespace`, unqualified names resolve in that namespace's schema. Rejects
 * non-SELECT/WITH input client-side before the server's own read-only check.
 */
export function useRunQuery() {
  const client = useWipClient()
  return useMutation({
    mutationFn: async ({ sql, namespace }: RunQueryInput): Promise<QueryResult> => {
      const trimmed = sql.trim()
      // Client-side safety: only SELECT allowed
      if (!/^\s*(SELECT|WITH)\b/i.test(trimmed)) {
        throw new Error('Only SELECT queries are allowed')
      }
      return runReportQuery(client, trimmed, namespace)
    },
  })
}

/** Read-only query as a cached query (e.g. a registered view's row preview). */
export function useQueryRows(sql: string, namespace: string | undefined, enabled = true) {
  const client = useWipClient()
  return useQuery({
    queryKey: ['rc-console', 'query-rows', namespace ?? '', sql],
    queryFn: () => runReportQuery(client, sql, namespace),
    enabled,
    staleTime: 30_000,
    retry: false,
  })
}

/** Autocomplete schema for the SQL editor: namespaces → tables (→ columns). */
export type SqlCompletionSchema = { [name: string]: SqlCompletionSchema | readonly string[] }

/**
 * Autocomplete schema for a SQL editor. Every namespace from the reporting
 * inventory appears with its table names, for schema-qualified queries. With
 * `namespace` set, that namespace's tables and views (registered views
 * included) are also offered unqualified with their columns, as the server
 * resolves unqualified names there. Undefined until the inventory loads.
 */
export function useSqlCompletionSchema(namespace?: string): SqlCompletionSchema | undefined {
  const client = useWipClient()
  const { data: tables } = useReportTables()
  const { data: columns } = useQuery({
    queryKey: ['rc-console', 'sql-completion-columns', namespace],
    queryFn: async () => {
      const result = await runReportQuery(
        client,
        'SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1 ORDER BY table_name, ordinal_position',
        undefined,
        [namespace],
      )
      const byTable: Record<string, string[]> = {}
      for (const row of result.rows) {
        const table = String(row.table_name ?? '')
        ;(byTable[table] ??= []).push(String(row.column_name ?? ''))
      }
      return byTable
    },
    enabled: !!namespace,
    staleTime: 300_000,
  })
  return useMemo(() => {
    if (!tables) return undefined
    const schema: SqlCompletionSchema = {}
    for (const t of tables) {
      const ns = (schema[t.namespace] ??= {}) as SqlCompletionSchema
      ns[t.name] = []
    }
    if (namespace && columns) {
      for (const [table, cols] of Object.entries(columns)) {
        if (!(table in schema)) schema[table] = cols
      }
    }
    return schema
  }, [tables, namespace, columns])
}

// useSyncStatus is now provided by @wip/react@0.9.0 (CASE-283).
// Import it directly from there:  import { useSyncStatus } from '@wip/react'
// Pass `{ refetchInterval: 60_000 }` if you want polling.
