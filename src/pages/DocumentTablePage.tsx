import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Layers,
  Archive,
  FileCode2,
} from 'lucide-react'
import { useTemplateByValue, useWipClient } from '@wip/react'
import { useQuery } from '@tanstack/react-query'
import type { TableColumn } from '@wip/client'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import Pagination from '@/components/common/Pagination'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Cell formatting
// ---------------------------------------------------------------------------

function formatCell(value: unknown, type: string): string {
  if (value === null || value === undefined) return '—'
  if (type === 'boolean') return value ? 'Yes' : 'No'
  if (type === 'date' && typeof value === 'string') {
    try { return new Date(value).toLocaleDateString() } catch { return String(value) }
  }
  if (type === 'datetime' && typeof value === 'string') {
    try { return new Date(value).toLocaleString() } catch { return String(value) }
  }
  if (typeof value === 'object') {
    const s = JSON.stringify(value)
    return s.length > 50 ? s.slice(0, 50) + '…' : s
  }
  return String(value)
}

function columnWidth(col: TableColumn): string {
  if (col.name === '_document_id' || col.name === '_identity_hash') return '150px'
  if (col.type === 'boolean') return '80px'
  if (col.type === 'date' || col.type === 'datetime' || col.name === '_created_at' || col.name === '_updated_at') return '130px'
  if (col.name === '_version' || col.name === '_status') return '80px'
  return '140px'
}

// ---------------------------------------------------------------------------
// Page size selector
// ---------------------------------------------------------------------------

const PAGE_SIZES = [25, 50, 100] as const

// ---------------------------------------------------------------------------
// Document Table Page
// ---------------------------------------------------------------------------

export default function DocumentTablePage() {
  const { templateValue } = useParams()
  const { namespace } = useNamespaceFilter()
  const { data: template, isLoading: templateLoading } = useTemplateByValue(templateValue ?? '')
  const client = useWipClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [showArchived, setShowArchived] = useState(false)
  const [exporting, setExporting] = useState(false)

  const templateId = template?.template_id ?? ''

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rc-console', 'table-view', templateId, page, pageSize, showArchived ? 'all' : 'active'],
    queryFn: () => client.documents.getTableView(templateId, {
      status: showArchived ? undefined : 'active',
      page,
      page_size: pageSize,
    }),
    enabled: !!templateId,
    staleTime: 30_000,
  })

  const handleExport = useCallback(async () => {
    if (!templateId) return
    setExporting(true)
    try {
      const blob = await client.documents.exportTableCsv(templateId, {
        status: showArchived ? undefined : 'active',
        include_metadata: true,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${templateValue}_documents.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }, [templateId, templateValue, showArchived, client])

  if (templateLoading) return <LoadingState label="Loading template..." />
  if (!template) return <ErrorState message="Template not found" />

  const columns = data?.columns ?? []
  const rows = data?.rows ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="space-y-4 max-w-[95vw]">
      {/* Header */}
      <div>
        <Link
          to={`/documents?template=${templateValue}${namespace ? `&ns=${namespace}` : ''}`}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 mb-2"
        >
          <ArrowLeft size={12} />
          Back to Documents
        </Link>
        <div className="flex items-center gap-3">
          <FileCode2 size={24} className="text-indigo-500" />
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-800">
              {template.label || template.value} — Table View
            </h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              <span className="font-mono">{template.value}</span>
              <span className="flex items-center gap-1"><Layers size={10} /> v{template.version ?? 1}</span>
              {data && <span>{data.total_documents} document{data.total_documents !== 1 ? 's' : ''}{data.total_rows !== data.total_documents ? ` (${data.total_rows} rows after array expansion)` : ''}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => { setShowArchived(v => !v); setPage(1) }}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md border transition-colors',
              showArchived
                ? 'border-gray-300 bg-gray-100 text-gray-700'
                : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:border-gray-300'
            )}
          >
            <Archive size={12} />
            {showArchived ? 'All' : 'Active'}
          </button>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white"
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} rows</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExport}
            disabled={exporting || !templateId}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download size={12} />
            {exporting ? 'Exporting...' : 'CSV'}
          </button>
          <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-gray-600" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingState label="Loading table..." />
      ) : error ? (
        <ErrorState
          message={error.message?.includes('500') || error.message?.includes('Internal')
            ? 'Table view unavailable. Ensure the template has reporting sync enabled (sync_enabled: true in reporting config).'
            : error.message}
          onRetry={() => refetch()}
        />
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No documents for this template.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
          <table className="text-sm w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {columns.map(col => (
                  <th
                    key={col.name}
                    className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    style={{ minWidth: columnWidth(col) }}
                  >
                    {col.label || col.name}
                    {col.is_flattened && (
                      <span className="ml-1 text-[8px] bg-teal-100 text-teal-700 px-1 py-0.5 rounded normal-case tracking-normal">flat</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-gray-50">
                  {columns.map(col => {
                    const val = row[col.name]
                    const isDocId = col.name === '_document_id'
                    return (
                      <td
                        key={col.name}
                        className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap truncate max-w-[300px]"
                        title={typeof val === 'string' ? val : undefined}
                      >
                        {isDocId && typeof val === 'string' ? (
                          <Link to={`/documents/${templateValue}/${val}`} className="text-blue-500 hover:text-blue-700 font-mono">
                            {val.slice(0, 12)}...
                          </Link>
                        ) : (
                          formatCell(val, col.type)
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  )
}
