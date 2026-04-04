import { useQuery, useMutation } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportTable {
  table_name: string
  columns: Array<{
    name: string
    type: string
  }>
  row_count?: number
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
  execution_time_ms?: number
}

export interface SyncStatus {
  status: string
  pending_events?: number
  last_sync?: string
  lag_ms?: number
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/wip/api/reporting-sync${path}`, init)
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
      if (!/^\s*SELECT\b/i.test(trimmed)) {
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

export function useSyncStatus() {
  return useQuery({
    queryKey: ['rc-console', 'sync-status'],
    queryFn: () => fetchJson<SyncStatus>('/status'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
