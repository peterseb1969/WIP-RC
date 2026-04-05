import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronRight, Hash, RefreshCw, Plus } from 'lucide-react'
import { useTerminologies, useCreateTerminology, useNamespaces } from '@wip/react'
import SearchInput from '@/components/common/SearchInput'
import Pagination from '@/components/common/Pagination'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'

// ---------------------------------------------------------------------------
// Create Terminology Form
// ---------------------------------------------------------------------------

function CreateTerminologyForm({ defaultNamespace, onClose }: { defaultNamespace: string; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [nsOverride, setNsOverride] = useState(defaultNamespace)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: namespaces } = useNamespaces()
  const create = useCreateTerminology({
    onSuccess: () => onClose(),
    onError: (err: Error) => setError(err.message),
  })

  const handleCreate = () => {
    const v = value.trim()
    if (!v) { setError('Value is required'); return }
    if (!nsOverride) { setError('Namespace is required'); return }
    if (!/^[A-Z][A-Z0-9_]*$/.test(v)) {
      setError('Value must be UPPER_SNAKE_CASE (e.g. DOCUMENT_STATUS)')
      return
    }
    create.mutate({
      value: v,
      label: label.trim() || v,
      description: description.trim() || undefined,
      namespace: nsOverride,
      case_sensitive: caseSensitive,
      created_by: 'rc-console',
    })
  }

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Create Terminology</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Value * (UPPER_SNAKE_CASE)</label>
            <input
              type="text"
              value={value}
              onChange={e => { setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')); setError(null) }}
              placeholder="DOCUMENT_STATUS"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-blue-400"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Document Status"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Namespace *</label>
            <select
              value={nsOverride}
              onChange={e => setNsOverride(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="">Select...</option>
              {namespaces?.filter(n => n.prefix !== 'ptest').map(n => (
                <option key={n.prefix} value={n.prefix}>{n.prefix}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 mt-4">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={e => setCaseSensitive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Case sensitive
          </label>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            disabled={create.isPending || !value.trim() || !nsOverride}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {create.isPending ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Terminology List Page
// ---------------------------------------------------------------------------

export default function TerminologyListPage() {
  const { namespace } = useNamespaceFilter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('active')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading, error, refetch } = useTerminologies({
    status: statusFilter || undefined,
    namespace: namespace || undefined,
    page,
    page_size: 25,
  })

  // Client-side search filter (API may not support text search on terminologies)
  const items = data?.items?.filter(t => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      t.value?.toLowerCase().includes(s) ||
      t.label?.toLowerCase().includes(s) ||
      t.description?.toLowerCase().includes(s)
    )
  }) ?? []

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Terminologies</h1>
          <p className="text-sm text-gray-400 mt-1">Browse and manage controlled vocabularies</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 border border-gray-200 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowCreate(s => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            <Plus size={14} />
            Create
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateTerminologyForm
          defaultNamespace={namespace}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search terminologies..."
          className="flex-1 max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
          className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="">All statuses</option>
        </select>
      </div>

      {/* Content */}
      {isLoading && <LoadingState label="Loading terminologies..." />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">No terminologies found.</p>
            ) : (
              items.map((t, i) => (
                <Link
                  key={`${t.terminology_id}-${t.namespace}-${i}`}
                  to={`/terminologies/${t.terminology_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <BookOpen size={16} className="text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{t.label || t.value}</span>
                      <span className="text-xs font-mono text-gray-400">{t.value}</span>
                    </div>
                    {t.description && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{t.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Hash size={10} />
                      {t.term_count ?? '—'} terms
                    </span>
                    {t.namespace && <span className="text-gray-400">{t.namespace}</span>}
                    <StatusBadge status={t.status === 'active' ? 'active' : 'inactive'} label={t.status} />
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0" />
                </Link>
              ))
            )}
          </div>

          <Pagination
            page={page}
            totalPages={data.pages ?? 1}
            onPageChange={setPage}
          />

          <p className="text-xs text-gray-400">
            {data.total ?? items.length} terminolog{(data.total ?? items.length) !== 1 ? 'ies' : 'y'} total
          </p>
        </>
      )}
    </div>
  )
}
