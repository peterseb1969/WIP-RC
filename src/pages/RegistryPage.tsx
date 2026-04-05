import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  BookOpen,
  FileCode2,
  FileText,
  FileIcon,
  FolderTree,
  Hash,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Calendar,
  LinkIcon,
} from 'lucide-react'
import { useRegistrySearch, useWipClient, useNamespaces } from '@wip/react'
import { useQuery } from '@tanstack/react-query'
import type { RegistrySearchResult } from '@wip/client'
import JsonViewer from '@/components/common/JsonViewer'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_TYPES = ['terminology', 'term', 'template', 'document', 'file'] as const
type EntityType = typeof ENTITY_TYPES[number]

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  terminology: <BookOpen size={12} className="text-purple-500" />,
  term: <Hash size={12} className="text-purple-400" />,
  template: <FileCode2 size={12} className="text-indigo-500" />,
  document: <FileText size={12} className="text-blue-500" />,
  file: <FileIcon size={12} className="text-pink-400" />,
}

const ENTITY_COLORS: Record<string, string> = {
  terminology: 'bg-purple-50 text-purple-700 border-purple-200',
  term: 'bg-purple-50 text-purple-600 border-purple-200',
  template: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  document: 'bg-blue-50 text-blue-700 border-blue-200',
  file: 'bg-pink-50 text-pink-700 border-pink-200',
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="inline-flex items-center p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Entity link builder
// ---------------------------------------------------------------------------

function entityLink(entry: { entry_id: string; entity_type: string; namespace: string; primary_composite_key: Record<string, unknown> }): string | null {
  const ns = entry.namespace ? `?ns=${entry.namespace}` : ''
  switch (entry.entity_type) {
    case 'terminology': return `/terminologies/${entry.entry_id}${ns}`
    case 'term': return null // terms don't have their own page — they're inline on terminology detail
    case 'template': return `/templates/${entry.entry_id}${ns}`
    case 'document': {
      const templateValue = entry.primary_composite_key?.template_value as string | undefined
      return `/documents/${templateValue ?? '_'}/${entry.entry_id}`
    }
    case 'file': return `/files/${entry.entry_id}`
    default: return null
  }
}

// ---------------------------------------------------------------------------
// Landing stats (no query)
// ---------------------------------------------------------------------------

function RegistryStats() {
  const client = useWipClient()
  const { data, isLoading } = useQuery({
    queryKey: ['rc-console', 'registry-stats'],
    queryFn: async () => {
      const results = await Promise.all(
        ENTITY_TYPES.map(async type => {
          const res = await client.registry.listEntries({ entity_type: type, page_size: 1 })
          return { type, total: res.total }
        })
      )
      const allEntries = await client.registry.listEntries({ page_size: 1 })
      return { byType: results, total: allEntries.total }
    },
    staleTime: 60_000,
  })

  if (isLoading) return <LoadingState label="Loading registry stats..." />
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Total Entries</div>
          <div className="text-2xl font-semibold text-gray-800">{data.total.toLocaleString()}</div>
        </div>
        {data.byType.map(({ type, total }) => (
          <div key={type} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              {ENTITY_ICONS[type]}
              <span className="capitalize">{type}s</span>
            </div>
            <div className="text-2xl font-semibold text-gray-800">{total.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-400 text-center py-4">
        Search by ID, value, label, or composite key — or browse all entries below.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Entity type filter chips
// ---------------------------------------------------------------------------

function TypeFilterChips({
  selected,
  onSelect,
}: {
  selected: EntityType | ''
  onSelect: (type: EntityType | '') => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onSelect('')}
        className={cn(
          'px-2.5 py-1 text-xs rounded-full border transition-colors',
          !selected ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
        )}
      >
        All
      </button>
      {ENTITY_TYPES.map(type => (
        <button
          key={type}
          onClick={() => onSelect(selected === type ? '' : type)}
          className={cn(
            'px-2.5 py-1 text-xs rounded-full border transition-colors capitalize flex items-center gap-1',
            selected === type ? ENTITY_COLORS[type] : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          {ENTITY_ICONS[type]}
          {type}s
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------

function ResultRow({
  result,
  isSelected,
  onClick,
}: {
  result: RegistrySearchResult
  isSelected: boolean
  onClick: () => void
}) {
  const matchedViaSynonym = result.matched_via === 'synonym_key_value'
  const link = entityLink(result)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 transition-colors',
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      )}
    >
      <div className="flex items-center gap-2">
        {ENTITY_ICONS[result.entity_type] ?? <Hash size={12} className="text-gray-400" />}
        <span className="text-sm text-gray-800 truncate font-medium">
          {result.matched_value || result.entry_id}
        </span>
        {matchedViaSynonym && (
          <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200">
            via synonym
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 ml-5">
        <span className={cn('capitalize px-1.5 py-0.5 rounded text-[10px]', ENTITY_COLORS[result.entity_type] ?? 'bg-gray-100 text-gray-600')}>
          {result.entity_type}
        </span>
        <span className="font-mono truncate">{result.entry_id}</span>
        {result.namespace && <span className="text-gray-400">{result.namespace}</span>}
        <StatusBadge status={result.status === 'active' ? 'active' : 'inactive'} label={result.status} />
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Structured detail panel
// ---------------------------------------------------------------------------

function EntryDetail({ entryId }: { entryId: string }) {
  const client = useWipClient()
  const { data: entry, isLoading, error } = useQuery({
    queryKey: ['rc-console', 'registry-entry', entryId],
    queryFn: () => client.registry.getEntry(entryId),
    enabled: !!entryId,
    staleTime: 30_000,
  })

  if (isLoading) return <LoadingState label="Loading entry..." />
  if (error) return <ErrorState message={(error as Error).message} />
  if (!entry) return null

  const link = entityLink(entry)

  return (
    <div className="space-y-3">
      {/* Header with link */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Entry Detail</h2>
        {link && (
          <Link
            to={link}
            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium"
          >
            <ExternalLink size={10} />
            View in Console
          </Link>
        )}
      </div>

      {/* Structured view */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        <div className="flex items-start gap-3 px-4 py-2.5">
          <span className="text-sm text-gray-500 shrink-0 min-w-[110px]">Entry ID</span>
          <span className="text-sm font-mono text-gray-800 flex items-center gap-1">
            {entry.entry_id}
            <CopyButton value={entry.entry_id} />
          </span>
        </div>
        <div className="flex items-start gap-3 px-4 py-2.5">
          <span className="text-sm text-gray-500 shrink-0 min-w-[110px]">Type</span>
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs capitalize', ENTITY_COLORS[entry.entity_type] ?? 'bg-gray-100')}>
            {ENTITY_ICONS[entry.entity_type]}
            {entry.entity_type}
          </span>
        </div>
        <div className="flex items-start gap-3 px-4 py-2.5">
          <span className="text-sm text-gray-500 shrink-0 min-w-[110px]">Namespace</span>
          <Link to={`/?ns=${entry.namespace}`} className="text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1">
            <FolderTree size={10} />
            {entry.namespace}
          </Link>
        </div>
        <div className="flex items-start gap-3 px-4 py-2.5">
          <span className="text-sm text-gray-500 shrink-0 min-w-[110px]">Status</span>
          <StatusBadge status={entry.status === 'active' ? 'active' : 'inactive'} label={entry.status} />
        </div>
        <div className="flex items-start gap-3 px-4 py-2.5">
          <span className="text-sm text-gray-500 shrink-0 min-w-[110px]">Composite Key</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(entry.primary_composite_key).map(([k, v]) => (
              <span key={k} className="inline-flex items-center bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                <span className="text-gray-400 mr-1">{k}:</span>{String(v)}
              </span>
            ))}
          </div>
        </div>
        {entry.created_at && (
          <div className="flex items-start gap-3 px-4 py-2.5">
            <span className="text-sm text-gray-500 shrink-0 min-w-[110px]">Created</span>
            <span className="text-sm text-gray-800 flex items-center gap-1">
              <Calendar size={10} className="text-gray-400" />
              {new Date(entry.created_at).toLocaleString()}
              {entry.created_by && <span className="text-gray-400 ml-1">by {entry.created_by}</span>}
            </span>
          </div>
        )}
        {entry.search_values && entry.search_values.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-2.5">
            <span className="text-sm text-gray-500 shrink-0 min-w-[110px]">Search Values</span>
            <div className="flex flex-wrap gap-1.5">
              {entry.search_values.map((v, i) => (
                <span key={i} className="inline-flex items-center bg-gray-50 text-gray-600 px-2 py-0.5 rounded text-xs border border-gray-200">
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Synonyms */}
      {entry.synonyms && entry.synonyms.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Synonyms ({entry.synonyms.length})
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {entry.synonyms.map((syn, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2">
                <LinkIcon size={12} className="text-gray-300 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(syn.composite_key).map(([k, v]) => (
                      <span key={k} className="inline-flex items-center bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs">
                        <span className="text-amber-400 mr-1">{k}:</span>{String(v)}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                    <span>{syn.namespace}</span>
                    <span className="capitalize">{syn.entity_type}</span>
                    {syn.created_at && <span>{new Date(syn.created_at).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON collapsed */}
      <div>
        <details className="group">
          <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none">
            Raw JSON
          </summary>
          <div className="mt-2">
            <JsonViewer data={entry} maxHeight="400px" collapsed />
          </div>
        </details>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Browse mode (no query, paginated)
// ---------------------------------------------------------------------------

function BrowseEntries({
  namespace,
  entityType,
}: {
  namespace: string
  entityType: EntityType | ''
}) {
  const client = useWipClient()
  const [page, setPage] = useState(1)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['rc-console', 'registry-browse', namespace, entityType, page],
    queryFn: () => client.registry.listEntries({
      namespace: namespace || undefined,
      entity_type: entityType || undefined,
      page,
      page_size: 25,
    }),
    staleTime: 30_000,
  })

  const items = data?.items ?? []

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-5">
        {isLoading && <LoadingState label="Loading entries..." />}
        {error && <ErrorState message={(error as Error).message} />}
        {data && (
          <>
            <div className="text-xs text-gray-400 mb-2">{data.total} entries{data.pages > 1 && ` — page ${page} of ${data.pages}`}</div>
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 p-6 text-center">No entries found.</p>
              ) : (
                items.map(entry => {
                  const keyValues = Object.values(entry.primary_composite_key).map(String).join(' / ')
                  return (
                    <button
                      key={entry.entry_id}
                      onClick={() => setSelectedEntryId(entry.entry_id)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 transition-colors',
                        selectedEntryId === entry.entry_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {ENTITY_ICONS[entry.entity_type] ?? <Hash size={12} className="text-gray-400" />}
                        <span className="text-sm text-gray-800 truncate font-medium">{keyValues || entry.entry_id}</span>
                        {entry.synonyms_count > 0 && (
                          <span className="text-[10px] text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                            {entry.synonyms_count} syn
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 ml-5">
                        <span className={cn('capitalize px-1.5 py-0.5 rounded text-[10px]', ENTITY_COLORS[entry.entity_type] ?? 'bg-gray-100')}>
                          {entry.entity_type}
                        </span>
                        <span className="font-mono truncate">{entry.entry_id}</span>
                        <span>{entry.namespace}</span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
            {data.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-50">Prev</button>
                <span className="text-xs text-gray-400">Page {page} of {data.pages}</span>
                <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages} className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-50">Next</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="col-span-7">
        {selectedEntryId ? (
          <EntryDetail entryId={selectedEntryId} />
        ) : (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">
            Select an entry to view details
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search results mode
// ---------------------------------------------------------------------------

function SearchResults({
  query,
  namespace,
  entityType,
}: {
  query: string
  namespace: string
  entityType: EntityType | ''
}) {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  const { data, isLoading, error } = useRegistrySearch({
    q: query,
    namespace: namespace || undefined,
    entity_type: entityType || undefined,
    page_size: 50,
  })

  const results = data?.items ?? []

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-5">
        {isLoading && <LoadingState label="Searching..." />}
        {error && <ErrorState message={error.message} />}
        {data && (
          <>
            <div className="text-xs text-gray-400 mb-2">{data.total} result{data.total !== 1 ? 's' : ''} for "{query}"</div>
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-sm text-gray-400 p-6 text-center">No results.</p>
              ) : (
                results.map(r => (
                  <ResultRow
                    key={r.entry_id}
                    result={r}
                    isSelected={selectedEntryId === r.entry_id}
                    onClick={() => setSelectedEntryId(r.entry_id)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="col-span-7">
        {selectedEntryId ? (
          <EntryDetail entryId={selectedEntryId} />
        ) : (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">
            Select an entry to view details
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Registry Page
// ---------------------------------------------------------------------------

export default function RegistryPage() {
  const { namespace } = useNamespaceFilter()
  const { data: namespaces } = useNamespaces()
  const [query, setQuery] = useState('')
  const [entityType, setEntityType] = useState<EntityType | ''>('')
  const [nsOverride, setNsOverride] = useState('')

  const effectiveNs = nsOverride || namespace

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Registry</h1>
        <p className="text-sm text-gray-400 mt-1">Identity management, composite keys, and synonyms</p>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by ID, value, label, or composite key..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
              autoFocus
            />
          </div>
          <select
            value={nsOverride}
            onChange={e => setNsOverride(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="">{namespace ? `${namespace} (global)` : 'All namespaces'}</option>
            {namespaces?.sort((a, b) => a.prefix.localeCompare(b.prefix)).map(ns => (
              <option key={ns.prefix} value={ns.prefix}>{ns.prefix}</option>
            ))}
          </select>
        </div>

        <TypeFilterChips selected={entityType} onSelect={setEntityType} />
      </div>

      {/* Content: stats, search results, or browse */}
      {!query && !entityType && !effectiveNs ? (
        <>
          <RegistryStats />
          <BrowseEntries namespace="" entityType="" />
        </>
      ) : !query ? (
        <BrowseEntries namespace={effectiveNs} entityType={entityType} />
      ) : (
        <SearchResults query={query} namespace={effectiveNs} entityType={entityType} />
      )}
    </div>
  )
}
