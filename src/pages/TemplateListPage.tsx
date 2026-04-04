import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileCode2, ChevronRight, Hash, Layers, RefreshCw } from 'lucide-react'
import { useTemplates, useNamespaces } from '@wip/react'
import SearchInput from '@/components/common/SearchInput'
import Pagination from '@/components/common/Pagination'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'

export default function TemplateListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const nsFilter = searchParams.get('namespace') || ''
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: namespaces } = useNamespaces()
  const { data, isLoading, error, refetch } = useTemplates({
    status: 'active',
    latest_only: true,
    namespace: nsFilter || undefined,
    page,
    page_size: 25,
  })

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
          <h1 className="text-2xl font-semibold text-gray-800">Templates</h1>
          <p className="text-sm text-gray-400 mt-1">Browse and manage document schemas</p>
        </div>
        <button onClick={() => refetch()} className="p-2 border border-gray-200 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search templates..." className="flex-1 max-w-sm" />
        <select
          value={nsFilter}
          onChange={e => {
            setSearchParams(prev => { if (e.target.value) prev.set('namespace', e.target.value); else prev.delete('namespace'); return prev })
            setPage(1)
          }}
          className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        >
          <option value="">All namespaces</option>
          {namespaces?.filter(ns => ns.prefix !== 'ptest').map(ns => (
            <option key={ns.prefix} value={ns.prefix}>{ns.prefix}</option>
          ))}
        </select>
      </div>

      {isLoading && <LoadingState label="Loading templates..." />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">No templates found.</p>
            ) : (
              items.map(t => (
                <Link
                  key={t.template_id}
                  to={`/templates/${t.template_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <FileCode2 size={16} className="text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{t.label || t.value}</span>
                      <span className="text-xs font-mono text-gray-400">{t.value}</span>
                    </div>
                    {t.description && <p className="text-xs text-gray-400 truncate mt-0.5">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Layers size={10} />v{t.version ?? 1}</span>
                    <span className="flex items-center gap-1"><Hash size={10} />{t.field_count ?? '—'} fields</span>
                    {t.namespace && <span className="text-gray-400">{t.namespace}</span>}
                    <StatusBadge status={t.status === 'active' ? 'active' : 'inactive'} label={t.status} />
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0" />
                </Link>
              ))
            )}
          </div>
          <Pagination page={page} totalPages={data.pages ?? 1} onPageChange={setPage} />
          <p className="text-xs text-gray-400">{data.total ?? items.length} template{(data.total ?? items.length) !== 1 ? 's' : ''} total</p>
        </>
      )}
    </div>
  )
}
