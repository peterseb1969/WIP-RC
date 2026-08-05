import { useState, useCallback, useRef, useEffect, useMemo, type MouseEvent } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Database,
  Play,
  Trash2,
  Clock,
  Table2,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Download,
  AlertCircle,
  History,
  Columns3,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  X,
  ListFilter,
} from 'lucide-react'
import {
  useReportTables,
  useReportingInventory,
  useTableColumns,
  useTablePage,
  useRunQuery,
  type QueryResult,
  type ReportTable,
  type ReportEntity,
} from '@/hooks/use-reporting'
import ParityPanel from '@/components/reporting/ParityPanel'
import { useSyncStatus } from '@wip/react'
import DataTable from '@/components/common/DataTable'
import Pagination from '@/components/common/Pagination'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import BatchSyncPanel from '@/components/reporting/BatchSyncPanel'
import { cn } from '@/lib/cn'
import { apiUrl } from '@/lib/wip'
import { useIsServiceInactive } from '@/hooks/use-service-health'

// ---------------------------------------------------------------------------
// Query History (persisted in localStorage)
// ---------------------------------------------------------------------------

interface HistoryEntry {
  sql: string
  namespace?: string
  timestamp: number
  rowCount: number
  executionTimeMs?: number
}

const HISTORY_KEY = 'rc-console:pg-query-history'
const MAX_HISTORY = 50

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
}

// ---------------------------------------------------------------------------
// Sync Status Bar
// ---------------------------------------------------------------------------

function SyncStatusBar() {
  const { data, isLoading } = useSyncStatus({ refetchInterval: 60_000 })
  // Tables count reads from the database (list_tables), not the
  // reporting-sync service's in-memory counter (status.tables_managed).
  // The runtime counter resets to 0 on service restart even when tables
  // persist in PostgreSQL — which made the UI lie about empty state.
  const { data: tables } = useReportTables()

  if (isLoading || !data) return null

  const isHealthy = data.running && data.connected_to_nats && data.connected_to_postgres
  const tableCount = tables?.length ?? 0

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
      <span className="font-medium">Reporting-Sync</span>
      <span className={cn('inline-flex items-center gap-1', isHealthy ? 'text-success' : 'text-amber-600')}>
        {isHealthy ? <CheckCircle size={12} /> : <XCircle size={12} />}
        {data.running ? 'Running' : 'Stopped'}
      </span>
      <span className={cn(data.connected_to_nats ? 'text-success' : 'text-danger')}>
        NATS: {data.connected_to_nats ? 'connected' : 'disconnected'}
      </span>
      <span className={cn(data.connected_to_postgres ? 'text-success' : 'text-danger')}>
        PG: {data.connected_to_postgres ? 'connected' : 'disconnected'}
      </span>
      <span>Events: {data.events_processed.toLocaleString()}</span>
      {data.events_failed > 0 && (
        <span className="text-amber-600">{data.events_failed} failed</span>
      )}
      <span>Tables: {tableCount}</span>
      {data.last_event_processed && (
        <span className="ml-auto">Last: {new Date(data.last_event_processed).toLocaleTimeString()}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table Browser (left panel)
// ---------------------------------------------------------------------------

const TABLE_PAGE_SIZES = [25, 50, 100] as const

// Download the whole reporting table as CSV via a blob + <a download>, matching
// the document Table View's export UX (client-controlled filename) rather than
// opening a raw server response in a new tab.
async function downloadTableCsv(table: ReportTable): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/wip/api/reporting-sync/export/csv?table=${encodeURIComponent(table.name)}&namespace=${encodeURIComponent(table.namespace)}`
    )
  )
  if (!res.ok) throw new Error(`CSV export failed: HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${table.namespace}_${table.name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Typed cell rendering for a PostgreSQL row, mirroring the document Table View's
// formatCell but keyed on information_schema data_type (not WIP field types).
export function formatPgCell(value: unknown, pgType?: string): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const t = (pgType ?? '').toLowerCase()
  if (typeof value === 'string' && (t.includes('timestamp') || t === 'date')) {
    // new Date(junk) yields an Invalid Date rather than throwing, so guard on
    // the parsed time and fall back to the raw string.
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) {
      return t === 'date' ? d.toLocaleDateString() : d.toLocaleString()
    }
    return value
  }
  if (typeof value === 'object') {
    const s = JSON.stringify(value)
    return s.length > 60 ? s.slice(0, 60) + '…' : s
  }
  return String(value)
}

function KindBadge({ kind }: { kind: ReportTable['kind'] }) {
  if (!kind) return null
  return (
    <span className={cn(
      'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
      kind === 'view' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500',
    )}>
      {kind}
    </span>
  )
}

function TableRow({
  table,
  label,
  indent,
  selected,
  onSelect,
}: {
  table: ReportTable
  label?: string
  indent?: boolean
  selected: boolean
  onSelect: (table: ReportTable) => void
}) {
  const handleDownloadCsv = (e: MouseEvent) => {
    e.stopPropagation()
    downloadTableCsv(table).catch(err => console.error('CSV export failed:', err))
  }
  return (
    <button
      onClick={() => onSelect(table)}
      className={cn(
        'w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-gray-50 transition-colors group',
        indent && 'pl-8',
        selected && 'bg-primary/5 text-primary-dark'
      )}
    >
      <Table2 size={14} className="text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">
          {table.name}
          {label && <span className="ml-2 text-[10px] text-gray-400 font-normal">{label}</span>}
        </div>
        <div className="text-xs text-gray-400">
          {table.column_count} cols · {table.row_count.toLocaleString()} rows
        </div>
      </div>
      <KindBadge kind={table.kind} />
      <Download
        size={14}
        className="text-gray-300 shrink-0 opacity-0 group-hover:opacity-100 hover:text-primary transition-all"
        onClick={(e) => handleDownloadCsv(e as unknown as MouseEvent)}
        aria-label={`Download ${table.name} as CSV`}
      />
      <ChevronRight size={14} className="text-gray-300 shrink-0" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Table Browser filtering (CASE-812) — namespace multiselect, name search,
// kind + per-version + empty toggles. State lives in the URL query string so a
// filtered view is shareable and survives reload; defaults are omitted from the
// URL, so an unfiltered browser has a clean address. The two "hide" toggles
// default ON — the noisy states (per-version physical tables, empty mirror
// relations) are opt-in to see, not opt-out.
// ---------------------------------------------------------------------------

export interface BrowserFilters {
  namespaces: string[] // empty = all namespaces
  query: string
  hideVersions: boolean // hide doc_*__vN per-version physical tables
  hideEmpty: boolean // hide row_count === 0 tables (drains, empty mirror relations)
  kind: 'all' | 'view' | 'table'
}

export const VERSION_TABLE_RE = /__v\d+$/

// A pre-split table carries no `kind`; treat it as a physical table so the kind
// filter behaves sensibly on legacy installs (no views exist there).
function effectiveKind(t: ReportTable): 'view' | 'table' {
  return t.kind ?? 'table'
}

export function tablePasses(t: ReportTable, f: BrowserFilters): boolean {
  if (f.hideEmpty && t.row_count === 0) return false
  if (f.hideVersions && VERSION_TABLE_RE.test(t.name)) return false
  if (f.kind !== 'all' && effectiveKind(t) !== f.kind) return false
  return true
}

export function nameMatches(name: string, q: string): boolean {
  return q === '' || name.toLowerCase().includes(q)
}

export function buildRelations(
  entity: ReportEntity,
  tableIndex: Map<string, ReportTable>
): Array<{ table: ReportTable; label: string }> {
  const lookup = (name: string) => tableIndex.get(`${entity.namespace}|${name}`)
  const relations: Array<{ table: ReportTable; label: string }> = []
  const defaultView = lookup(entity.default_view)
  if (defaultView) relations.push({ table: defaultView, label: 'default query surface' })
  const entitiesView = lookup(entity.entities_view)
  if (entitiesView) relations.push({ table: entitiesView, label: 'entities' })
  for (const v of entity.versions) {
    const t = lookup(v.table)
    if (t) relations.push({ table: t, label: `v${v.version}` })
  }
  return relations
}

// Relations of an entity that survive the active filters. When the query hits
// the entity name, all filter-passing relations show; when it only hits a child
// table, just the matching children show.
export function visibleEntityRelations(
  entity: ReportEntity,
  tableIndex: Map<string, ReportTable>,
  f: BrowserFilters
): { entityHit: boolean; relations: Array<{ table: ReportTable; label: string }> } {
  const q = f.query.trim().toLowerCase()
  const entityHit = nameMatches(entity.entity, q)
  let relations = buildRelations(entity, tableIndex).filter(r => tablePasses(r.table, f))
  if (q && !entityHit) {
    relations = relations.filter(r => nameMatches(r.table.name, q))
  }
  return { entityHit, relations }
}

function FilterBar({
  filters,
  allNamespaces,
  shownTables,
  totalTables,
  shownNamespaces,
  onToggleNamespace,
  onClearNamespaces,
  onSetQuery,
  onToggleHideVersions,
  onToggleHideEmpty,
  onSetKind,
  onClearAll,
}: {
  filters: BrowserFilters
  allNamespaces: string[]
  shownTables: number
  totalTables: number
  shownNamespaces: number
  onToggleNamespace: (ns: string) => void
  onClearNamespaces: () => void
  onSetQuery: (q: string) => void
  onToggleHideVersions: () => void
  onToggleHideEmpty: () => void
  onSetKind: (k: BrowserFilters['kind']) => void
  onClearAll: () => void
}) {
  const anyActive =
    filters.namespaces.length > 0 ||
    filters.query.trim() !== '' ||
    !filters.hideVersions ||
    !filters.hideEmpty ||
    filters.kind !== 'all'

  return (
    <div className="shrink-0 border-b border-gray-200 bg-white p-2 space-y-2">
      {/* Name search */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={filters.query}
          onChange={e => onSetQuery(e.target.value)}
          placeholder="Filter tables by name…"
          className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary placeholder-gray-400"
        />
        {filters.query && (
          <button
            onClick={() => onSetQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Namespace multiselect chips */}
      {allNamespaces.length > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          {allNamespaces.map(ns => {
            const active = filters.namespaces.includes(ns)
            return (
              <button
                key={ns}
                onClick={() => onToggleNamespace(ns)}
                className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                  active
                    ? 'bg-primary/10 border-primary/30 text-primary-dark font-medium'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                )}
                title={active ? `Showing ${ns} — click to remove` : `Add ${ns} to the filter`}
              >
                {ns}
              </button>
            )
          })}
          {filters.namespaces.length > 0 && (
            <button
              onClick={onClearNamespaces}
              className="text-[11px] px-1.5 py-0.5 text-gray-400 hover:text-gray-600"
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* Toggles + kind */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
        <label className="inline-flex items-center gap-1 cursor-pointer select-none">
          <input type="checkbox" checked={filters.hideVersions} onChange={onToggleHideVersions} className="accent-primary" />
          Hide per-version tables
        </label>
        <label className="inline-flex items-center gap-1 cursor-pointer select-none">
          <input type="checkbox" checked={filters.hideEmpty} onChange={onToggleHideEmpty} className="accent-primary" />
          Hide empty
        </label>
        <span className="inline-flex items-center rounded-md border border-gray-200 overflow-hidden">
          {(['all', 'view', 'table'] as const).map(k => (
            <button
              key={k}
              onClick={() => onSetKind(k)}
              className={cn(
                'px-1.5 py-0.5 capitalize transition-colors',
                filters.kind === k ? 'bg-primary/10 text-primary-dark font-medium' : 'text-gray-500 hover:bg-gray-50'
              )}
            >
              {k === 'all' ? 'all' : k + 's'}
            </button>
          ))}
        </span>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span className="inline-flex items-center gap-1">
          <ListFilter size={11} />
          {shownTables} of {totalTables} tables · {shownNamespaces}/{allNamespaces.length} namespaces
        </span>
        {anyActive && (
          <button onClick={onClearAll} className="text-gray-400 hover:text-primary underline decoration-dotted">
            reset filters
          </button>
        )}
      </div>
    </div>
  )
}

// Entity-first browser (CASE-710/716): each entity expands to its derived
// views + per-version physical tables. Relations of one entity overlap by
// construction, so only the entity-level row_count is a document count.
// Relations arrive pre-filtered (CASE-812); forceExpanded opens the group while
// a name filter is active so matching children are visible without a click.
function EntityGroup({
  entity,
  relations,
  forceExpanded,
  selectedTable,
  onSelectTable,
}: {
  entity: ReportEntity
  relations: Array<{ table: ReportTable; label: string }>
  forceExpanded: boolean
  selectedTable: ReportTable | null
  onSelectTable: (table: ReportTable) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isOpen = forceExpanded || expanded

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-gray-50 transition-colors"
      >
        {isOpen
          ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
          : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium text-gray-700">{entity.entity}</div>
          <div className="text-xs text-gray-400">
            {entity.row_count.toLocaleString()} docs · {entity.versions.length} version{entity.versions.length !== 1 ? 's' : ''}
          </div>
        </div>
        {entity.legacy_table && (
          <span
            className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0"
            title="A pre-split physical table shadows the entity view — see the Parity tab for remediation."
          >
            legacy table
          </span>
        )}
        {!entity.default_view_present && (
          <span className="text-[10px] bg-danger/5 text-danger px-1.5 py-0.5 rounded font-medium shrink-0">
            view missing
          </span>
        )}
      </button>
      {isOpen && relations.length > 0 && (
        <div className="divide-y divide-gray-50">
          {relations.map(({ table, label }) => (
            <TableRow
              key={table.qualified_name}
              table={table}
              label={label}
              indent
              selected={selectedTable?.qualified_name === table.qualified_name}
              onSelect={onSelectTable}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TableBrowser({
  selectedTable,
  onSelectTable,
}: {
  selectedTable: ReportTable | null
  onSelectTable: (table: ReportTable) => void
}) {
  const { data: inventory, isLoading, error, refetch } = useReportingInventory()
  const [searchParams, setSearchParams] = useSearchParams()

  const filters: BrowserFilters = useMemo(() => {
    const rawKind = searchParams.get('kind')
    return {
      namespaces: (searchParams.get('ns') ?? '').split(',').map(s => s.trim()).filter(Boolean),
      query: searchParams.get('find') ?? '',
      hideVersions: searchParams.get('vers') !== '1', // default true; vers=1 reveals them
      hideEmpty: searchParams.get('empty') !== '1', // default true; empty=1 reveals them
      kind: rawKind === 'view' || rawKind === 'table' ? rawKind : 'all',
    }
  }, [searchParams])

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        prev => {
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '') prev.delete(k)
            else prev.set(k, v)
          }
          return prev
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const toggleNamespace = useCallback(
    (ns: string) => {
      const next = filters.namespaces.includes(ns)
        ? filters.namespaces.filter(n => n !== ns)
        : [...filters.namespaces, ns]
      patchParams({ ns: next.length ? next.join(',') : null })
    },
    [filters.namespaces, patchParams]
  )

  const clearAll = useCallback(
    () => patchParams({ ns: null, find: null, vers: null, empty: null, kind: null }),
    [patchParams]
  )

  if (isLoading) return <LoadingState label="Loading tables..." />
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />

  const tables = inventory?.tables ?? []
  const entities = inventory?.entities ?? []

  if (tables.length === 0) {
    return <p className="text-sm text-gray-400 p-4">No reporting tables found.</p>
  }

  // One PG schema per namespace since CASE-628 — group the browser accordingly.
  const allNamespaces = [...new Set(tables.map(t => t.namespace))].sort()
  const nsAllowed = (ns: string) => filters.namespaces.length === 0 || filters.namespaces.includes(ns)
  const q = filters.query.trim().toLowerCase()
  const isFlat = entities.length === 0 // pre-CASE-710 install: no entity structure

  const tableIndex = new Map(tables.map(t => [`${t.namespace}|${t.name}`, t]))
  const entityTableNames = new Set(
    entities.flatMap(e => [
      `${e.namespace}|${e.default_view}`,
      `${e.namespace}|${e.entities_view}`,
      ...e.versions.map(v => `${e.namespace}|${v.table}`),
    ])
  )

  // Build the filtered, render-ready structure once so the result count and the
  // tree agree by construction.
  type FlatSection = { ns: string; mode: 'flat'; tables: ReportTable[] }
  type EntitySection = {
    ns: string
    mode: 'entity'
    entities: Array<{ entity: ReportEntity; relations: Array<{ table: ReportTable; label: string }> }>
    other: ReportTable[]
  }
  const sections: Array<FlatSection | EntitySection> = allNamespaces
    .filter(nsAllowed)
    .map((ns): FlatSection | EntitySection => {
      if (isFlat) {
        return {
          ns,
          mode: 'flat',
          tables: tables.filter(t => t.namespace === ns && tablePasses(t, filters) && nameMatches(t.name, q)),
        }
      }
      const nsEntities = entities
        .filter(e => e.namespace === ns)
        .sort((a, b) => a.entity.localeCompare(b.entity))
        .map(e => {
          const { entityHit, relations } = visibleEntityRelations(e, tableIndex, filters)
          return { entity: e, relations, show: entityHit || relations.length > 0 }
        })
        .filter(x => x.show)
        .map(({ entity, relations }) => ({ entity, relations }))
      const other = tables.filter(
        t =>
          t.namespace === ns &&
          !entityTableNames.has(`${t.namespace}|${t.name}`) &&
          tablePasses(t, filters) &&
          nameMatches(t.name, q)
      )
      return { ns, mode: 'entity', entities: nsEntities, other }
    })
    .filter(s =>
      s.mode === 'flat' ? s.tables.length > 0 : s.entities.length > 0 || s.other.length > 0
    )

  const shownTables = sections.reduce(
    (sum, s) =>
      sum +
      (s.mode === 'flat'
        ? s.tables.length
        : s.entities.reduce((n, e) => n + e.relations.length, 0) + s.other.length),
    0
  )

  const filterBar = (
    <FilterBar
      filters={filters}
      allNamespaces={allNamespaces}
      shownTables={shownTables}
      totalTables={tables.length}
      shownNamespaces={sections.length}
      onToggleNamespace={toggleNamespace}
      onClearNamespaces={() => patchParams({ ns: null })}
      onSetQuery={query => patchParams({ find: query || null })}
      onToggleHideVersions={() => patchParams({ vers: filters.hideVersions ? '1' : null })}
      onToggleHideEmpty={() => patchParams({ empty: filters.hideEmpty ? '1' : null })}
      onSetKind={k => patchParams({ kind: k === 'all' ? null : k })}
      onClearAll={clearAll}
    />
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {filterBar}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sections.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">
            No tables match the current filters.{' '}
            <button onClick={clearAll} className="text-primary hover:underline">
              Reset
            </button>
          </div>
        ) : (
          sections.map(section => (
            <div key={section.ns}>
              <div className="sticky top-0 px-3 py-1.5 bg-gray-50 border-y border-gray-100 text-xs font-medium text-gray-500 first:border-t-0 z-10">
                {section.ns}
              </div>
              <div className="divide-y divide-gray-100">
                {section.mode === 'flat'
                  ? section.tables.map(table => (
                      <TableRow
                        key={table.qualified_name}
                        table={table}
                        selected={selectedTable?.qualified_name === table.qualified_name}
                        onSelect={onSelectTable}
                      />
                    ))
                  : (
                    <>
                      {section.entities.map(({ entity, relations }) => (
                        <EntityGroup
                          key={`${entity.namespace}|${entity.entity}`}
                          entity={entity}
                          relations={relations}
                          forceExpanded={q !== ''}
                          selectedTable={selectedTable}
                          onSelectTable={onSelectTable}
                        />
                      ))}
                      {section.other.length > 0 && (
                        <div>
                          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-300">
                            other tables
                          </div>
                          {section.other.map(table => (
                            <TableRow
                              key={table.qualified_name}
                              table={table}
                              selected={selectedTable?.qualified_name === table.qualified_name}
                              onSelect={onSelectTable}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table Detail Panel
// ---------------------------------------------------------------------------

function TableDetail({ table }: { table: ReportTable }) {
  const { data: columnData, isLoading: columnsLoading } = useTableColumns(table)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [exporting, setExporting] = useState(false)
  const { data: pageData, isLoading: rowsLoading, error, isPlaceholderData } = useTablePage(table, page, pageSize)

  // pg data_type per column name, for typed cell rendering.
  const typeByName = useMemo(
    () => new Map((columnData?.columns ?? []).map(c => [c.name, c.type])),
    [columnData]
  )

  const totalRows = table.row_count
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const columns = pageData?.columns ?? []
  const rows = pageData?.rows ?? []

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadTableCsv(table)
    } catch (err) {
      console.error('CSV export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Table summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <span className="font-mono font-medium text-gray-700">{table.qualified_name}</span>
          {' — '}{table.column_count} columns, {totalRows.toLocaleString()} rows
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 hover:text-primary transition-colors disabled:opacity-50"
          title={`Download ${table.name} as CSV`}
        >
          <Download size={12} />
          {exporting ? 'Exporting…' : 'CSV'}
        </button>
      </div>

      {/* Column schema */}
      {columnsLoading && <LoadingState label="Loading columns..." />}
      {columnData && columnData.columns.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Columns3 size={14} />
            Columns ({columnData.columns.length})
          </h3>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
            <div className="grid grid-cols-2 gap-1 text-xs">
              {columnData.columns.map(col => (
                <div key={col.name} className="flex items-center gap-2 py-0.5">
                  <span className="font-mono text-gray-700">{col.name}</span>
                  <span className="text-gray-400">{col.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Data — full paginated table (parity with the document Table View) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Data</h3>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white"
          >
            {TABLE_PAGE_SIZES.map(s => <option key={s} value={s}>{s} rows</option>)}
          </select>
        </div>
        {rowsLoading && !pageData ? (
          <LoadingState label="Loading rows..." />
        ) : error ? (
          <ErrorState message={error.message} />
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400">Table is empty.</p>
        ) : (
          <>
            <div className={cn('overflow-x-auto border border-gray-200 rounded-lg bg-white', isPlaceholderData && 'opacity-60')}>
              <table className="text-sm w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {columns.map(col => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-gray-50">
                      {columns.map(col => {
                        const val = row[col]
                        const isDocLink =
                          col === 'document_id' && !!table.template_value && typeof val === 'string'
                        return (
                          <td
                            key={col}
                            className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap truncate max-w-[300px]"
                            title={typeof val === 'string' ? val : undefined}
                          >
                            {isDocLink ? (
                              <Link
                                to={`/documents/${table.template_value}/${val as string}`}
                                className="text-primary hover:text-primary-dark font-mono"
                              >
                                {(val as string).slice(0, 12)}…
                              </Link>
                            ) : (
                              formatPgCell(val, typeByName.get(col))
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-3">
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SQL Query Pad (right panel)
// ---------------------------------------------------------------------------

function QueryPad() {
  const [sql, setSql] = useState('SELECT * FROM ')
  const [namespace, setNamespace] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const runQuery = useRunQuery()
  const { data: tables } = useReportTables()
  const namespaces = [...new Set((tables ?? []).map(t => t.namespace))].sort()

  const handleExecute = useCallback(() => {
    const trimmed = sql.trim()
    if (!trimmed) return

    runQuery.mutate({ sql: trimmed, namespace: namespace || undefined }, {
      onSuccess: (data) => {
        setResult(data)
        const entry: HistoryEntry = {
          sql: trimmed,
          namespace: namespace || undefined,
          timestamp: Date.now(),
          rowCount: data.row_count,
          executionTimeMs: data.execution_time_ms,
        }
        const updated = [entry, ...history.filter(h => h.sql !== trimmed)]
        setHistory(updated)
        saveHistory(updated)
      },
      onError: () => {
        setResult(null)
      },
    })
  }, [sql, namespace, history, runQuery])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd + Enter to execute
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleExecute()
      }
    },
    [handleExecute]
  )

  const handleLoadFromHistory = (entry: HistoryEntry) => {
    setSql(entry.sql)
    setNamespace(entry.namespace ?? '')
    setShowHistory(false)
    textareaRef.current?.focus()
  }

  const handleClearHistory = () => {
    setHistory([])
    saveHistory([])
  }

  const handleExportCsv = async () => {
    if (!sql.trim()) return
    try {
      const resp = await fetch(apiUrl('/wip/api/reporting-sync/export/csv'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          namespace ? { sql: sql.trim(), namespace } : { sql: sql.trim() }
        ),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        throw new Error(`Export failed: HTTP ${resp.status} ${text}`)
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `query-result-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CSV export failed:', err)
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = `${Math.max(120, Math.min(ta.scrollHeight, 300))}px`
    }
  }, [sql])

  return (
    <div className="space-y-4">
      {/* Editor */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={e => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full font-mono text-sm bg-gray-900 text-success/60 rounded-lg border border-gray-700 p-4 resize-none focus:outline-none focus:border-primary placeholder-gray-600"
          placeholder={namespace ? 'SELECT * FROM doc_...' : 'SELECT * FROM "namespace"."doc_..."'}
          spellCheck={false}
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to run
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Tables live in per-namespace PG schemas (CASE-628). Selecting a
            namespace lets unqualified doc_* names resolve there; the blank
            choice requires schema-qualified names but allows cross-namespace
            JOINs. */}
        <select
          value={namespace}
          onChange={e => setNamespace(e.target.value)}
          className="px-2 py-2 text-sm border border-gray-200 rounded-md text-gray-600 bg-white focus:outline-none focus:border-primary"
          aria-label="Namespace for unqualified table names"
        >
          <option value="">All namespaces (qualify names)</option>
          {namespaces.map(ns => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>

        <button
          onClick={handleExecute}
          disabled={runQuery.isPending || !sql.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play size={14} />
          {runQuery.isPending ? 'Running...' : 'Execute'}
        </button>

        <button
          onClick={() => setShowHistory(h => !h)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md',
            showHistory ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          )}
        >
          <History size={14} />
          History ({history.length})
        </button>

        {result && (
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50"
          >
            <Download size={14} />
            Export CSV
          </button>
        )}

        {/* Result metadata */}
        {result && (
          <span className="text-xs text-gray-400 ml-auto">
            {result.row_count} row{result.row_count !== 1 ? 's' : ''}
            {result.execution_time_ms !== undefined && ` · ${result.execution_time_ms}ms`}
          </span>
        )}
      </div>

      {/* Error */}
      {runQuery.error && (
        <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-lg text-sm text-danger">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="font-mono text-xs whitespace-pre-wrap">{runQuery.error.message}</div>
        </div>
      )}

      {/* History panel */}
      {showHistory && (
        <div className="bg-white border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No query history.</p>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-500">Query History</span>
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-danger/60 hover:text-danger inline-flex items-center gap-1"
                >
                  <Trash2 size={10} />
                  Clear
                </button>
              </div>
              {history.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => handleLoadFromHistory(entry)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  <div className="font-mono text-xs text-gray-700 truncate">{entry.sql}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                    <Clock size={10} />
                    {new Date(entry.timestamp).toLocaleString()}
                    {entry.namespace && (
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{entry.namespace}</span>
                    )}
                    <span>{entry.rowCount} rows</span>
                    {entry.executionTimeMs !== undefined && <span>{entry.executionTimeMs}ms</span>}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Results table */}
      {result && result.rows.length > 0 && (
        <DataTable columns={result.columns} rows={result.rows} maxHeight="400px" />
      )}
      {result && result.rows.length === 0 && !runQuery.error && (
        <p className="text-sm text-gray-400">Query returned 0 rows.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PostgreSQL Page
// ---------------------------------------------------------------------------

export default function PostgresPage() {
  const [selectedTable, setSelectedTable] = useState<ReportTable | null>(null)
  const [activeTab, setActiveTab] = useState<'browser' | 'query' | 'sync' | 'parity'>('browser')
  const isInactive = useIsServiceInactive('reporting-sync')

  if (isInactive) {
    return (
      <div className="space-y-4 max-w-7xl">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Database size={24} className="text-gray-400" />
            PostgreSQL
          </h1>
          <p className="text-sm text-gray-400 mt-1">Reporting layer inspection and ad-hoc queries</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
          <Database size={16} className="text-gray-400" />
          <span>Reporting-Sync module not deployed in this WIP instance. PostgreSQL reporting tables are unavailable.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Database size={24} className="text-primary" />
          PostgreSQL
        </h1>
        <p className="text-sm text-gray-400 mt-1">Reporting layer inspection and ad-hoc queries</p>
      </div>

      <SyncStatusBar />

      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('browser')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'browser'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Table2 size={14} />
            Table Browser
          </span>
        </button>
        <button
          onClick={() => setActiveTab('query')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'query'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Play size={14} />
            Query Pad
          </span>
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'sync'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={14} />
            Batch Sync
          </span>
        </button>
        <button
          onClick={() => setActiveTab('parity')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'parity'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={14} />
            Parity
          </span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'browser' && (
        <div className="grid grid-cols-12 gap-4">
          {/* Left: table list */}
          <div className="col-span-4 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col max-h-[calc(100vh-280px)]">
            <TableBrowser selectedTable={selectedTable} onSelectTable={setSelectedTable} />
          </div>

          {/* Right: table detail */}
          <div className="col-span-8">
            {selectedTable ? (
              <TableDetail key={selectedTable.qualified_name} table={selectedTable} />
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-gray-400">
                Select a table to inspect its schema and data
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'query' && <QueryPad />}

      {activeTab === 'sync' && <BatchSyncPanel />}

      {activeTab === 'parity' && <ParityPanel />}
    </div>
  )
}
