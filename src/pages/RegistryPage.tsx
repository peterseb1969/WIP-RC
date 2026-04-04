import { useState } from 'react'
import { BookMarked, Search, Hash, Tag, Link2, RefreshCw } from 'lucide-react'
import { useRegistrySearch, useWipClient } from '@wip/react'
import { useQuery } from '@tanstack/react-query'
import SearchInput from '@/components/common/SearchInput'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import JsonViewer from '@/components/common/JsonViewer'
import StatusBadge from '@/components/common/StatusBadge'

export default function RegistryPage() {
  const [query, setQuery] = useState('')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  const { data, isLoading, error } = useRegistrySearch(
    query ? { q: query } : { q: '' }
  )

  const client = useWipClient()
  const { data: entryDetail } = useQuery({
    queryKey: ['rc-console', 'registry-entry', selectedEntryId],
    queryFn: () => client.registry.getEntry(selectedEntryId!),
    enabled: !!selectedEntryId,
    staleTime: 30_000,
  })

  const results = data?.results ?? []

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Registry</h1>
        <p className="text-sm text-gray-400 mt-1">ID management, synonyms, and merge</p>
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by ID, composite key, or text..."
        className="max-w-lg"
        autoFocus
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Results list */}
        <div className="col-span-5">
          {!query && (
            <p className="text-sm text-gray-400 py-8 text-center">Enter a search query to find registry entries.</p>
          )}
          {query && isLoading && <LoadingState label="Searching..." />}
          {query && error && <ErrorState message={error.message} />}
          {query && data && (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-sm text-gray-400 p-6 text-center">No results for "{query}"</p>
              ) : (
                results.map((r: Record<string, unknown>) => (
                  <button
                    key={String(r.id ?? r.entry_id)}
                    onClick={() => setSelectedEntryId(String(r.id ?? r.entry_id))}
                    className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${
                      selectedEntryId === String(r.id ?? r.entry_id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="text-sm text-gray-800 truncate">
                      {String(r.label ?? r.value ?? r.id)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span className="font-mono">{String(r.id ?? r.entry_id)}</span>
                      {r.type && <span>{String(r.type)}</span>}
                      {r.status && (
                        <StatusBadge
                          status={r.status === 'active' ? 'active' : 'inactive'}
                          label={String(r.status)}
                        />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Entry detail */}
        <div className="col-span-7">
          {selectedEntryId && entryDetail ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Entry Detail
              </h2>
              <JsonViewer data={entryDetail} maxHeight="500px" />
            </div>
          ) : selectedEntryId ? (
            <LoadingState label="Loading entry..." />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              Select an entry to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
