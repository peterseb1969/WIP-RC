import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Database,
  Play,
  Trash2,
  Clock,
  Table2,
  ChevronRight,
  Download,
  AlertCircle,
  History,
  Columns3,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import {
  useReportTables,
  useTableColumns,
  useTablePreview,
  useRunQuery,
  useSyncStatus,
  type QueryResult,
} from '@/hooks/use-reporting'
import DataTable from '@/components/common/DataTable'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Query History (persisted in localStorage)
// ---------------------------------------------------------------------------

interface HistoryEntry {
  sql: string
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
  const { data, isLoading } = useSyncStatus()

  if (isLoading || !data) return null

  const isHealthy = data.running && data.connected_to_nats && data.connected_to_postgres

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
      <span className="font-medium">Reporting-Sync</span>
      <span className={cn('inline-flex items-center gap-1', isHealthy ? 'text-green-600' : 'text-amber-600')}>
        {isHealthy ? <CheckCircle size={12} /> : <XCircle size={12} />}
        {data.running ? 'Running' : 'Stopped'}
      </span>
      <span className={cn(data.connected_to_nats ? 'text-green-600' : 'text-red-500')}>
        NATS: {data.connected_to_nats ? 'connected' : 'disconnected'}
      </span>
      <span className={cn(data.connected_to_postgres ? 'text-green-600' : 'text-red-500')}>
        PG: {data.connected_to_postgres ? 'connected' : 'disconnected'}
      </span>
      <span>Events: {data.events_processed.toLocaleString()}</span>
      {data.events_failed > 0 && (
        <span className="text-amber-600">{data.events_failed} failed</span>
      )}
      <span>Tables: {data.tables_managed}</span>
      {data.last_event_processed && (
        <span className="ml-auto">Last: {new Date(data.last_event_processed).toLocaleTimeString()}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table Browser (left panel)
// ---------------------------------------------------------------------------

function TableBrowser({
  selectedTable,
  onSelectTable,
}: {
  selectedTable: string | null
  onSelectTable: (name: string) => void
}) {
  const { data: tables, isLoading, error, refetch } = useReportTables()

  if (isLoading) return <LoadingState label="Loading tables..." />
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />

  if (!tables || tables.length === 0) {
    return <p className="text-sm text-gray-400 p-4">No reporting tables found.</p>
  }

  return (
    <div className="divide-y divide-gray-100">
      {tables.map((table, i) => (
        <button
          key={`${table.name}-${i}`}
          onClick={() => onSelectTable(table.name)}
          className={cn(
            'w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm hover:bg-gray-50 transition-colors',
            selectedTable === table.name && 'bg-blue-50 text-blue-700'
          )}
        >
          <Table2 size={14} className="text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium">{table.name}</div>
            <div className="text-xs text-gray-400">
              {table.column_count} cols · {table.row_count.toLocaleString()} rows
            </div>
          </div>
          <ChevronRight size={14} className="text-gray-300 shrink-0" />
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table Detail Panel
// ---------------------------------------------------------------------------

function TableDetail({ tableName }: { tableName: string }) {
  const { data: tables } = useReportTables()
  const { data: columnData, isLoading: columnsLoading } = useTableColumns(tableName)
  const { data: preview, isLoading: previewLoading, error } = useTablePreview(tableName)

  const table = tables?.find(t => t.name === tableName)

  return (
    <div className="space-y-4">
      {/* Table summary */}
      {table && (
        <div className="text-sm text-gray-500">
          <span className="font-mono font-medium text-gray-700">{table.name}</span>
          {' — '}{table.column_count} columns, {table.row_count.toLocaleString()} rows
        </div>
      )}

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

      {/* Sample data */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Sample Data (first 10 rows)</h3>
        {previewLoading && <LoadingState label="Loading preview..." />}
        {error && <ErrorState message={error.message} />}
        {preview && preview.rows.length > 0 && (
          <DataTable columns={preview.columns} rows={preview.rows} maxHeight="300px" />
        )}
        {preview && preview.rows.length === 0 && (
          <p className="text-sm text-gray-400">Table is empty.</p>
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
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const runQuery = useRunQuery()

  const handleExecute = useCallback(() => {
    const trimmed = sql.trim()
    if (!trimmed) return

    runQuery.mutate(trimmed, {
      onSuccess: (data) => {
        setResult(data)
        const entry: HistoryEntry = {
          sql: trimmed,
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
  }, [sql, history, runQuery])

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
    setShowHistory(false)
    textareaRef.current?.focus()
  }

  const handleClearHistory = () => {
    setHistory([])
    saveHistory([])
  }

  const handleExportCsv = () => {
    if (!result || result.rows.length === 0) return
    const header = result.columns.join(',')
    const rows = result.rows.map(row =>
      result.columns.map(col => {
        const val = row[col]
        if (val === null || val === undefined) return ''
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query-result-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
          className="w-full font-mono text-sm bg-gray-900 text-green-400 rounded-lg border border-gray-700 p-4 resize-none focus:outline-none focus:border-blue-500 placeholder-gray-600"
          placeholder="SELECT * FROM doc_..."
          spellCheck={false}
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to run
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleExecute}
          disabled={runQuery.isPending || !sql.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {result && result.rows.length > 0 && (
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50"
          >
            <Download size={14} />
            CSV
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
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
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
                  className="text-xs text-red-400 hover:text-red-600 inline-flex items-center gap-1"
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
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'browser' | 'query'>('browser')

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Database size={24} className="text-blue-500" />
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
              ? 'border-blue-500 text-blue-600'
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
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Play size={14} />
            Query Pad
          </span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'browser' && (
        <div className="grid grid-cols-12 gap-4">
          {/* Left: table list */}
          <div className="col-span-4 bg-white border border-gray-200 rounded-lg overflow-hidden max-h-[calc(100vh-280px)] overflow-y-auto">
            <TableBrowser selectedTable={selectedTable} onSelectTable={setSelectedTable} />
          </div>

          {/* Right: table detail */}
          <div className="col-span-8">
            {selectedTable ? (
              <TableDetail tableName={selectedTable} />
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-gray-400">
                Select a table to inspect its schema and data
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'query' && <QueryPad />}
    </div>
  )
}
