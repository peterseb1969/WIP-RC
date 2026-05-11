import { useState, useCallback, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  BookOpen,
  FileCode2,
  FileText,
  Tag,
  File as FileIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Settings2,
} from 'lucide-react'
import { useWipClient } from '@wip/react'
import type {
  EntityDetails,
  EntityReference,
  IncomingReference,
  SearchResult,
} from '@wip/client'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/cn'

// Default-off advanced search options (CASE-150).
type SearchMode = 'auto' | 'fts' | 'substring'
interface SearchOptions {
  mode: SearchMode
  includeInactive: boolean
  snippetFormat: 'html' | 'text'
  template: string
}
const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  mode: 'auto',
  includeInactive: false,
  snippetFormat: 'text',
  template: '',
}

// Sanitize ts_headline output: HTML-escape everything, then re-inject only
// <b>/</b> tags (which Postgres produces around match spans). Rest of the
// snippet body is user-supplied document content and must stay escaped.
function sanitizeSnippet(html: string): string {
  const escaped = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  return escaped.replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>')
}

// ---------------------------------------------------------------------------
// Type icons + entity links
// ---------------------------------------------------------------------------

const TYPE_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  terminology: BookOpen,
  term: Tag,
  template: FileCode2,
  document: FileText,
  file: FileIcon,
}

function entityLink(type: string, id: string, templateValue?: string | null): string {
  switch (type) {
    case 'terminology': return `/terminologies/${id}`
    case 'term': return `/terminologies/_/terms/${id}` // best effort — tid unknown
    case 'template': return `/templates/${id}`
    case 'document': return `/documents/${templateValue ?? '_'}/${id}`
    case 'file': return `/files/${id}`
    default: return '#'
  }
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    terminology: 'bg-orange-100 text-orange-700',
    term: 'bg-amber-100 text-amber-700',
    template: 'bg-indigo-100 text-indigo-700',
    document: 'bg-primary/10 text-primary-dark',
    file: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium', colors[type] ?? 'bg-gray-100 text-gray-500')}>
      {type}
    </span>
  )
}

function RefStatusIcon({ status }: { status: string }) {
  if (status === 'valid') return <CheckCircle size={12} className="text-success" />
  if (status === 'broken') return <XCircle size={12} className="text-danger" />
  return <AlertTriangle size={12} className="text-amber-500" />
}

// ---------------------------------------------------------------------------
// Search bar
// ---------------------------------------------------------------------------

function SearchBar({ onSearch, loading }: { onSearch: (q: string) => void; loading: boolean }) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) onSearch(query.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative flex-1 max-w-lg">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, value, or ID..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !query.trim()}
        className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
      </button>
    </form>
  )
}

function SearchOptionsPanel({
  options,
  onChange,
}: {
  options: SearchOptions
  onChange: (o: SearchOptions) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const dirty =
    options.mode !== DEFAULT_SEARCH_OPTIONS.mode ||
    options.includeInactive !== DEFAULT_SEARCH_OPTIONS.includeInactive ||
    options.snippetFormat !== DEFAULT_SEARCH_OPTIONS.snippetFormat ||
    options.template !== DEFAULT_SEARCH_OPTIONS.template

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors',
          dirty
            ? 'border-primary/30 bg-primary/5 text-primary-dark'
            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
        )}
      >
        <Settings2 size={12} />
        Advanced
        {dirty && <span className="text-[10px] text-primary">●</span>}
      </button>
      {expanded && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-3 py-3 bg-gray-50 border border-gray-200 rounded-md text-xs">
          <div>
            <label className="block text-gray-500 mb-1">Mode</label>
            <select
              value={options.mode}
              onChange={e => onChange({ ...options, mode: e.target.value as SearchMode })}
              className="w-full border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
            >
              <option value="auto">Auto</option>
              <option value="fts">FTS only</option>
              <option value="substring">Substring only</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-1">Snippet format</label>
            <select
              value={options.snippetFormat}
              onChange={e =>
                onChange({ ...options, snippetFormat: e.target.value as 'html' | 'text' })
              }
              className="w-full border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
              title="HTML preserves <b>...</b> match highlighting; text strips all tags."
            >
              <option value="text">Text</option>
              <option value="html">HTML (highlighted)</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-1">Template filter</label>
            <input
              type="text"
              value={options.template}
              onChange={e => onChange({ ...options, template: e.target.value })}
              placeholder="(any)"
              className="w-full border border-gray-200 rounded px-2 py-1 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-primary-light"
            />
          </div>
          <label className="flex items-center gap-2 self-end pb-1 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeInactive}
              onChange={e => onChange({ ...options, includeInactive: e.target.checked })}
            />
            <span className="text-gray-600">Include inactive</span>
          </label>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search results list
// ---------------------------------------------------------------------------

function SearchResults({
  results,
  snippetFormat,
  onInspect,
}: {
  results: SearchResult[]
  snippetFormat: 'html' | 'text'
  onInspect: (type: string, id: string) => void
}) {
  if (results.length === 0) return <p className="text-sm text-gray-400 text-center py-6">No results found.</p>

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
      {results.map((r, i) => {
        const Icon = TYPE_ICON[r.type] ?? FileText
        const hasFts = r.score != null || r.snippet != null
        // Files can't be inspected via reporting-sync's references endpoints
        // (backend rejects entity_type=file with 400). Render file rows as
        // <Link> to the file detail page; everything else stays a <button>
        // that triggers in-page inspection.
        const rowClass = "w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
        const rowKey = `${r.id}-${i}`
        const rowInner = (
          <>
            <Icon size={14} className="text-gray-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-700">{r.label || r.value || r.id}</span>
                {r.value && r.label && (
                  <span className="text-xs font-mono text-gray-400">{r.value}</span>
                )}
                {hasFts && r.score != null && (
                  <span
                    className="px-1.5 py-0.5 rounded bg-success/5 text-success text-[10px] font-mono"
                    title="ts_rank — relative FTS relevance"
                  >
                    {r.score.toFixed(3)}
                  </span>
                )}
              </div>
              {r.snippet && (
                snippetFormat === 'html' ? (
                  <p
                    className="text-xs text-gray-500 mt-0.5 [&>b]:bg-yellow-100 [&>b]:font-semibold [&>b]:px-0.5 [&>b]:rounded-sm"
                    dangerouslySetInnerHTML={{ __html: sanitizeSnippet(r.snippet) }}
                  />
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.snippet.replace(/<\/?b>/g, '')}
                  </p>
                )
              )}
            </div>
            <TypeBadge type={r.type} />
            <ChevronRight size={14} className="text-gray-300 shrink-0 mt-0.5" />
          </>
        )
        return r.type === 'file' ? (
          <Link key={rowKey} to={entityLink(r.type, r.id)} className={rowClass}>
            {rowInner}
          </Link>
        ) : (
          <button key={rowKey} onClick={() => onInspect(r.type, r.id)} className={rowClass}>
            {rowInner}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Entity inspector — outgoing + incoming references
// ---------------------------------------------------------------------------

function EntityInspector({
  entity,
  incoming,
  incomingTotal,
  loading,
  onInspect,
}: {
  entity: EntityDetails | null
  incoming: IncomingReference[]
  incomingTotal: number
  loading: boolean
  onInspect: (type: string, id: string) => void
}) {
  if (loading) return <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-500"><Loader2 size={14} className="animate-spin" />Loading references...</div>
  if (!entity) return null

  return (
    <div className="space-y-4">
      {/* Entity header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <TypeBadge type={entity.entity_type} />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-800">{entity.entity_label || entity.entity_value || entity.entity_id}</span>
            {entity.entity_value && (
              <span className="text-xs font-mono text-gray-400 ml-2">{entity.entity_value}</span>
            )}
          </div>
          {entity.entity_status && (
            <StatusBadge status={entity.entity_status === 'active' ? 'active' : 'inactive'} label={entity.entity_status} />
          )}
          <Link
            to={entityLink(entity.entity_type, entity.entity_id)}
            className="text-xs text-primary hover:text-primary-dark"
          >
            Open
          </Link>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
          <span className="font-mono">{entity.entity_id}</span>
          {entity.version && <span>v{entity.version}</span>}
          {entity.created_at && <span>Created: {new Date(entity.created_at).toLocaleDateString()}</span>}
        </div>
      </div>

      {/* Outgoing references */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ArrowUpRight size={12} />
          Outgoing References ({entity.references.length})
          {entity.broken_refs > 0 && <span className="text-danger">({entity.broken_refs} broken)</span>}
        </h3>
        {entity.references.length === 0 ? (
          <p className="text-xs text-gray-400">No outgoing references.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {entity.references.map((ref, i) => (
              <OutgoingRefRow key={i} ref_={ref} onInspect={onInspect} />
            ))}
          </div>
        )}
      </div>

      {/* Incoming references */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ArrowDownLeft size={12} />
          Referenced By ({incomingTotal})
        </h3>
        {incoming.length === 0 ? (
          <p className="text-xs text-gray-400">Not referenced by anything.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {incoming.map((ref, i) => (
              <IncomingRefRow key={i} ref_={ref} onInspect={onInspect} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OutgoingRefRow({ ref_, onInspect }: { ref_: EntityReference; onInspect: (type: string, id: string) => void }) {
  return (
    <button
      onClick={() => onInspect(ref_.ref_type, ref_.ref_id)}
      className="w-full flex items-center gap-3 px-4 py-2 text-xs hover:bg-gray-50 transition-colors text-left"
    >
      <RefStatusIcon status={ref_.status} />
      <TypeBadge type={ref_.ref_type} />
      <span className="text-primary hover:text-primary-dark truncate">
        {ref_.ref_label || ref_.ref_value || ref_.ref_id}
      </span>
      {ref_.field_path && <span className="text-gray-400 font-mono">{ref_.field_path}</span>}
      {ref_.error && <span className="text-danger">{ref_.error}</span>}
    </button>
  )
}

function IncomingRefRow({ ref_, onInspect }: { ref_: IncomingReference; onInspect: (type: string, id: string) => void }) {
  return (
    <button
      onClick={() => onInspect(ref_.entity_type, ref_.entity_id)}
      className="w-full flex items-center gap-3 px-4 py-2 text-xs hover:bg-gray-50 transition-colors text-left"
    >
      <TypeBadge type={ref_.entity_type} />
      <span className="text-primary hover:text-primary-dark truncate">
        {ref_.entity_label || ref_.entity_value || ref_.entity_id}
      </span>
      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{ref_.reference_type}</span>
      {ref_.field_path && <span className="text-gray-400 font-mono">{ref_.field_path}</span>}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Audit Explorer Page
// ---------------------------------------------------------------------------

export default function AuditExplorerPage() {
  const client = useWipClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [inspectedEntity, setInspectedEntity] = useState<EntityDetails | null>(null)
  const [incomingRefs, setIncomingRefs] = useState<IncomingReference[]>([])
  const [incomingTotal, setIncomingTotal] = useState(0)
  const [inspecting, setInspecting] = useState(false)
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS)

  const handleSearch = useCallback(async (query: string) => {
    setSearching(true)
    setSearchError(null)
    setInspectedEntity(null)
    setSearchParams(prev => { prev.set('q', query); prev.delete('type'); prev.delete('id'); return prev }, { replace: true })
    try {
      const res = await client.reporting.search({
        query,
        limit: 50,
        mode: searchOptions.mode,
        include_inactive: searchOptions.includeInactive,
        snippet_format: searchOptions.snippetFormat,
        ...(searchOptions.template.trim() ? { template: searchOptions.template.trim() } : {}),
      })
      // CASE-329: search response is now per-type buckets; flatten back to
      // a single SearchResult[] for the existing render path. (Per-bucket
      // pagination + type tabs is a future UX iteration.)
      const flat = Object.values(res.results).flatMap(b => b.items)
      setSearchResults(flat)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }, [client, setSearchParams, searchOptions])

  const handleInspect = useCallback(async (type: string, id: string) => {
    setInspecting(true)
    setSearchParams(prev => { prev.set('type', type); prev.set('id', id); return prev }, { replace: true })
    try {
      const entityType = type as 'document' | 'template' | 'terminology' | 'term' | 'file'
      const [outgoing, incoming] = await Promise.all([
        client.reporting.getEntityReferences(entityType, id),
        client.reporting.getReferencedBy(entityType, id),
      ])
      setInspectedEntity(outgoing.entity)
      setIncomingRefs(incoming.referenced_by)
      setIncomingTotal(incoming.total)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to load references')
    } finally {
      setInspecting(false)
    }
  }, [client, setSearchParams])

  // Restore from URL params on mount
  useEffect(() => {
    const q = searchParams.get('q')
    const type = searchParams.get('type')
    const id = searchParams.get('id')
    if (q && !searchResults) handleSearch(q)
    if (type && id && !inspectedEntity && !inspecting) handleInspect(type, id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Audit Explorer</h1>
        <p className="text-sm text-gray-400 mt-1">Search entities and inspect their references (outgoing + incoming).</p>
      </div>

      <div className="space-y-2">
        <SearchBar onSearch={handleSearch} loading={searching} />
        <SearchOptionsPanel options={searchOptions} onChange={setSearchOptions} />
      </div>

      {searchError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-danger/5 border border-danger/20 rounded-lg text-sm text-danger">
          <AlertTriangle size={14} className="shrink-0" />
          {searchError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: search results */}
        <div>
          {searchResults !== null && !searching && (
            <>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Results ({searchResults.length})
              </h2>
              <SearchResults results={searchResults} snippetFormat={searchOptions.snippetFormat} onInspect={handleInspect} />
            </>
          )}
        </div>

        {/* Right: entity inspector */}
        <div>
          {(inspectedEntity || inspecting) && (
            <>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Inspector</h2>
              <EntityInspector
                entity={inspectedEntity}
                incoming={incomingRefs}
                incomingTotal={incomingTotal}
                loading={inspecting}
                onInspect={handleInspect}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
