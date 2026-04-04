import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  FileText,
  ChevronRight,
  Hash,
  Layers,
  RefreshCw,
  Table2,
  Calendar,
} from 'lucide-react'
import { useTemplates, useDocuments } from '@wip/react'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'
import SearchInput from '@/components/common/SearchInput'
import Pagination from '@/components/common/Pagination'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Template Selector
// ---------------------------------------------------------------------------

function TemplateSelector({
  selectedTemplate,
  onSelect,
}: {
  selectedTemplate: string | null
  onSelect: (templateId: string, templateValue: string) => void
}) {
  const { namespace } = useNamespaceFilter()
  const { data, isLoading } = useTemplates({ status: 'active', latest_only: true, namespace: namespace || undefined, page_size: 100 })

  if (isLoading) return <LoadingState label="Loading templates..." />

  const templates = data?.items ?? []
  if (templates.length === 0) return <p className="text-sm text-gray-400">No templates available.</p>

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {templates.map(t => (
        <button
          key={t.template_id}
          onClick={() => onSelect(t.template_id, t.value)}
          className={cn(
            'text-left p-3 rounded-lg border transition-all',
            selectedTemplate === t.template_id
              ? 'border-blue-300 bg-blue-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <Layers size={12} className="text-indigo-400" />
            <span className="text-xs font-mono text-gray-400">v{t.version ?? 1}</span>
          </div>
          <div className="text-sm font-medium text-gray-800 truncate">{t.label || t.value}</div>
          <div className="text-xs text-gray-400 mt-0.5 truncate">{t.value}</div>
          {t.namespace && <div className="text-[10px] text-gray-300 mt-1">{t.namespace}</div>}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Document Table for a selected template
// ---------------------------------------------------------------------------

function DocumentTable({
  templateId,
  templateValue,
}: {
  templateId: string
  templateValue: string
}) {
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useDocuments({
    template_id: templateId,
    status: 'active',
    page,
    page_size: 25,
  })

  if (isLoading) return <LoadingState label="Loading documents..." />
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />

  const items = data?.items ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          {data?.total ?? 0} document{(data?.total ?? 0) !== 1 ? 's' : ''}
        </h2>
        <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-gray-600" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No documents for this template.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {items.map(doc => {
            const docData = (doc.data ?? {}) as Record<string, unknown>
            // Show first 3 data fields as preview
            const previewFields = Object.entries(docData).slice(0, 3)

            return (
              <Link
                key={doc.document_id}
                to={`/documents/${templateValue}/${doc.document_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <FileText size={16} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">{doc.document_id}</span>
                    <span className="text-[10px] text-gray-300">v{doc.version ?? 1}</span>
                  </div>
                  {previewFields.length > 0 && (
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      {previewFields.map(([k, v]) => (
                        <span key={k} className="truncate max-w-[150px]">
                          <span className="text-gray-400">{k}:</span> {formatValue(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                  {doc.created_at && (
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  )}
                  <StatusBadge status={doc.status === 'active' ? 'active' : 'inactive'} label={doc.status} />
                </div>
                <ChevronRight size={14} className="text-gray-300 shrink-0" />
              </Link>
            )
          })}
        </div>
      )}

      <Pagination page={page} totalPages={data?.pages ?? 1} onPageChange={setPage} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Document List Page
// ---------------------------------------------------------------------------

export default function DocumentListPage() {
  const [searchParams] = useSearchParams()
  const templateParam = searchParams.get('template') || ''

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedTemplateValue, setSelectedTemplateValue] = useState<string>(templateParam)

  const handleSelectTemplate = (id: string, value: string) => {
    setSelectedTemplateId(id)
    setSelectedTemplateValue(value)
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Documents</h1>
        <p className="text-sm text-gray-400 mt-1">Select a template to browse documents</p>
      </div>

      {/* Template selector */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Templates</h2>
        <TemplateSelector selectedTemplate={selectedTemplateId} onSelect={handleSelectTemplate} />
      </div>

      {/* Document list */}
      {selectedTemplateId && selectedTemplateValue && (
        <DocumentTable templateId={selectedTemplateId} templateValue={selectedTemplateValue} />
      )}
    </div>
  )
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 50)
  return String(v).slice(0, 50)
}
