import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Layers,
  RefreshCw,
  Calendar,
  Search,
  X,
} from 'lucide-react'
import { useTemplates, useDocuments } from '@wip/react'
import { useNamespaceFilter, useSyncNamespaceFromUrl } from '@/hooks/use-namespace-filter'
import Pagination from '@/components/common/Pagination'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/cn'

const CARD_THRESHOLD = 8
const LAST_TEMPLATE_KEY = 'rc-console:last-template'

// ---------------------------------------------------------------------------
// localStorage helpers for last-used template (keyed by namespace)
// ---------------------------------------------------------------------------

function getLastTemplate(namespace: string): { id: string; value: string } | null {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_TEMPLATE_KEY) || '{}')
    return stored[namespace] ?? null
  } catch { return null }
}

function setLastTemplate(namespace: string, id: string, value: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_TEMPLATE_KEY) || '{}')
    stored[namespace] = { id, value }
    localStorage.setItem(LAST_TEMPLATE_KEY, JSON.stringify(stored))
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Card Selector (< CARD_THRESHOLD templates)
// ---------------------------------------------------------------------------

function TemplateCards({
  templates,
  selectedId,
  onSelect,
}: {
  templates: Array<{ template_id: string; value: string; label?: string | null; version?: number | null; namespace?: string | null; fields?: unknown[] | null }>
  selectedId: string | null
  onSelect: (id: string, value: string) => void
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {templates.map(t => (
        <button
          key={t.template_id}
          onClick={() => onSelect(t.template_id, t.value)}
          className={cn(
            'text-left p-3 rounded-lg border transition-all',
            selectedId === t.template_id
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
// Combobox Selector (>= CARD_THRESHOLD templates)
// ---------------------------------------------------------------------------

function TemplateCombobox({
  templates,
  selectedId,
  onSelect,
}: {
  templates: Array<{ template_id: string; value: string; label?: string | null; version?: number | null; namespace?: string | null; fields?: unknown[] | null }>
  selectedId: string | null
  onSelect: (id: string, value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = templates.find(t => t.template_id === selectedId)

  const filtered = search
    ? templates.filter(t => {
        const s = search.toLowerCase()
        return t.value.toLowerCase().includes(s) || (t.label?.toLowerCase().includes(s))
      })
    : templates

  const handleSelect = (t: typeof templates[0]) => {
    onSelect(t.template_id, t.value)
    setOpen(false)
    setSearch('')
  }

  // close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // focus input when opening
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
    } else if (e.key === 'Enter' && filtered.length === 1) {
      if (filtered[0]) handleSelect(filtered[0])
    }
  }, [filtered])

  return (
    <div ref={containerRef} className="relative max-w-lg">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm transition-colors',
          open ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300',
          'bg-white'
        )}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <Layers size={14} className="text-indigo-400 shrink-0" />
            <span className="font-medium text-gray-800 truncate">{selected.label || selected.value}</span>
            <span className="text-xs font-mono text-gray-400 truncate">{selected.value}</span>
          </span>
        ) : (
          <span className="text-gray-400">Select a template...</span>
        )}
        <ChevronDown size={14} className={cn('text-gray-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search templates..."
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-300"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Template list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No templates match.</p>
            ) : (
              filtered.map(t => (
                <button
                  key={t.template_id}
                  onClick={() => handleSelect(t)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                    t.template_id === selectedId
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  )}
                >
                  <Layers size={12} className={t.template_id === selectedId ? 'text-blue-400' : 'text-indigo-400'} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate">{t.label || t.value}</span>
                    <span className="text-xs font-mono text-gray-400 ml-2">{t.value}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                    <span>v{t.version ?? 1}</span>
                    {t.fields && <span>{t.fields.length} fields</span>}
                    {t.namespace && <span>{t.namespace}</span>}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="px-3 py-1.5 border-t border-gray-100 text-[10px] text-gray-300">
            {filtered.length} of {templates.length} templates
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Template Selector (auto-adaptive)
// ---------------------------------------------------------------------------

function TemplateSelector({
  selectedId,
  onSelect,
  onTemplatesLoaded,
}: {
  selectedId: string | null
  onSelect: (id: string, value: string) => void
  onTemplatesLoaded?: (templates: Array<{ template_id: string; value: string }>) => void
}) {
  const { namespace } = useNamespaceFilter()
  const { data, isLoading } = useTemplates({ status: 'active', latest_only: true, namespace: namespace || undefined, page_size: 100 })
  const notifiedRef = useRef(false)

  const templates = data?.items ?? []

  // notify parent once when templates load (for auto-recall)
  useEffect(() => {
    if (templates.length > 0 && !notifiedRef.current) {
      notifiedRef.current = true
      onTemplatesLoaded?.(templates)
    }
  }, [templates])

  // reset notification flag when namespace changes
  useEffect(() => {
    notifiedRef.current = false
  }, [namespace])

  if (isLoading) return <LoadingState label="Loading templates..." />
  if (templates.length === 0) return <p className="text-sm text-gray-400">No templates available.</p>

  if (templates.length < CARD_THRESHOLD) {
    return <TemplateCards templates={templates} selectedId={selectedId} onSelect={onSelect} />
  }

  return <TemplateCombobox templates={templates} selectedId={selectedId} onSelect={onSelect} />
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
  useSyncNamespaceFromUrl()
  const { namespace } = useNamespaceFilter()
  const [searchParams] = useSearchParams()
  const templateParam = searchParams.get('template') || ''

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedTemplateValue, setSelectedTemplateValue] = useState<string>(templateParam)

  const nsKey = namespace || '__all__'

  const handleSelectTemplate = (id: string, value: string) => {
    setSelectedTemplateId(id)
    setSelectedTemplateValue(value)
    setLastTemplate(nsKey, id, value)
  }

  // auto-recall last-used template when templates finish loading
  const handleTemplatesLoaded = useCallback((templates: Array<{ template_id: string; value: string }>) => {
    // don't override if already selected
    if (selectedTemplateId) return

    // resolve URL ?template= param to an ID
    if (templateParam) {
      const match = templates.find(t => t.value === templateParam)
      if (match) {
        setSelectedTemplateId(match.template_id)
        setSelectedTemplateValue(match.value)
        setLastTemplate(nsKey, match.template_id, match.value)
        return
      }
    }

    const last = getLastTemplate(nsKey)
    if (last && templates.some(t => t.template_id === last.id)) {
      setSelectedTemplateId(last.id)
      setSelectedTemplateValue(last.value)
    }
  }, [nsKey, selectedTemplateId, templateParam])

  // reset selection when namespace changes
  useEffect(() => {
    setSelectedTemplateId(null)
    setSelectedTemplateValue('')
  }, [namespace])

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Documents</h1>
        <p className="text-sm text-gray-400 mt-1">Select a template to browse documents</p>
      </div>

      {/* Template selector — key on namespace to remount cleanly on switch */}
      <TemplateSelector
        key={nsKey}
        selectedId={selectedTemplateId}
        onSelect={handleSelectTemplate}
        onTemplatesLoaded={handleTemplatesLoaded}
      />

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
