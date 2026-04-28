import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileCode2, ChevronRight, Hash, Layers, RefreshCw, Plus, Archive, Network } from 'lucide-react'
import { useTemplates } from '@wip/react'
import { isEdgeType, type TemplateExt } from '@/types/wip-extensions'
import SearchInput from '@/components/common/SearchInput'
import Pagination from '@/components/common/Pagination'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import { useNamespaceFilter, useSyncNamespaceFromUrl } from '@/hooks/use-namespace-filter'

export default function TemplateListPage() {
  useSyncNamespaceFromUrl()
  const { namespace } = useNamespaceFilter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showAll, setShowAll] = useState(false)

  const { data, isLoading, error, refetch } = useTemplates({
    status: showAll ? undefined : 'active',
    latest_only: true,
    namespace: namespace || undefined,
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
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 border border-gray-200 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50" title="Refresh">
            <RefreshCw size={14} />
          </button>
          {namespace ? (
            <Link
              to="/templates/new"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              <Plus size={14} />
              Create
            </Link>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600/50 text-white/70 text-sm rounded-md cursor-not-allowed"
              title="Select a namespace first"
            >
              <Plus size={14} />
              Create
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search templates..." className="flex-1 max-w-sm" />
        <button
          type="button"
          onClick={() => { setShowAll(v => !v); setPage(1) }}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
            showAll
              ? 'border-gray-300 bg-gray-100 text-gray-700'
              : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:border-gray-300'
          }`}
          title={showAll ? 'Showing all templates (active + inactive). Click to show active only.' : 'Showing active only. Click to include inactive.'}
        >
          <Archive size={12} />
          {showAll ? 'All' : 'Active'}
        </button>
      </div>

      {isLoading && <LoadingState label="Loading templates..." />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">No templates found.</p>
            ) : (
              items.map(t => {
                const tExt = t as TemplateExt
                const edge = isEdgeType(tExt)
                return (
                  <Link
                    key={t.template_id}
                    to={`/templates/${t.template_id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    {edge ? (
                      <Network size={16} className="text-purple-500 shrink-0" />
                    ) : (
                      <FileCode2 size={16} className="text-indigo-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{t.label || t.value}</span>
                        <span className="text-xs font-mono text-gray-400">{t.value}</span>
                        {edge && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-medium"
                            title="Edge type — same shape as a template, different lifecycle. Source/target validated at write time. See PoNIF #7."
                          >
                            Edge type
                          </span>
                        )}
                        {tExt.versioned === false && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium"
                            title="Updates overwrite in place; documents stay at version 1 forever. See PoNIF #8."
                          >
                            unversioned
                          </span>
                        )}
                      </div>
                      {t.description && <p className="text-xs text-gray-400 truncate mt-0.5">{t.description}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Layers size={10} />v{t.version ?? 1}</span>
                      <span className="flex items-center gap-1"><Hash size={10} />{t.fields?.length ?? '—'} fields</span>
                      {t.namespace && <span className="text-gray-400">{t.namespace}</span>}
                      <StatusBadge status={t.status === 'active' ? 'active' : 'inactive'} label={t.status} />
                    </div>
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </Link>
                )
              })
            )}
          </div>
          <Pagination page={page} totalPages={data.pages ?? 1} onPageChange={setPage} />
          <p className="text-xs text-gray-400">{data.total ?? items.length} template{(data.total ?? items.length) !== 1 ? 's' : ''} total</p>
        </>
      )}
    </div>
  )
}
