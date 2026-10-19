import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, Search, X, Tag } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTerms, useTerminologies, useWipClient } from '@wip/react'
import { WipNotFoundError } from '@wip/client'
import type { FieldDefinition, Term, Terminology } from '@wip/client'
import { cn } from '@/lib/cn'
import { resolveTerminologyRef } from '@/lib/reference-targets'

// ---------------------------------------------------------------------------
// TermFieldInput — searchable combobox over a terminology's terms.
//
// `field.terminology_ref` is a terminology id, `ns:VALUE`, or a bare value that
// means the document's own namespace (resolveTerminologyRef). An id that is
// not in the terminology list is fetched directly.
//
// With the search box empty, the dropdown lists the terminology's first
// BROWSE_CAP active terms (the list endpoints' page maximum). Typing searches
// the whole terminology on the server (def-store term search), which also
// matches a term's names (aliases): large vocabularies often keep the readable
// name there and a code in the value.
//
// The form state stores the term's `value` (not its ID) — that's what the
// Document schema expects for `term` fields (it resolves to a TermReference
// on the server side). A stored value outside the browse list is looked up on
// its own, so an existing document shows its term rather than "not found".
// ---------------------------------------------------------------------------

/** Most terms the dropdown lists before the user types: the list endpoints' page maximum. */
const BROWSE_CAP = 1000
/** Most matches one search returns: the term search endpoint's maximum. */
const SEARCH_LIMIT = 100
const DEBOUNCE_MS = 300

export interface TermFieldInputProps {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  /** The document's namespace: a bare `terminology_ref` value resolves in it. */
  namespace?: string
  /** id for the trigger button, so the field's <label htmlFor> names it. */
  id?: string
}

interface TermRow {
  term: Term
  /** The name the search matched, when it matched a name rather than the value or label. */
  matchedName: string | null
}

/**
 * Searchable term picker for a `term` field; stores the term's value. Browses
 * the first BROWSE_CAP terms and searches all of them (see header above).
 */
export default function TermFieldInput({ field, value, onChange, disabled, namespace, id }: TermFieldInputProps) {
  const client = useWipClient()
  const ref = field.terminology_ref ?? ''
  const { terminology, unresolved } = useResolvedTerminology(ref, namespace)
  const terminologyId = terminology?.terminology_id ?? ''

  const { data: termsData, isLoading } = useTerms(
    terminologyId,
    { status: 'active', page_size: BROWSE_CAP },
    { enabled: !!terminologyId },
  )
  const terms = termsData?.items ?? []
  const totalTerms = termsData?.total ?? terms.length

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const searchQuery = useQuery({
    queryKey: ['rc-console', 'term-field-search', terminologyId, debounced],
    queryFn: () =>
      client.defStore.searchTerms(debounced, {
        terminology: terminologyId,
        namespace: terminology!.namespace,
        mode: 'substring',
        limit: SEARCH_LIMIT,
        statuses: 'active',
      }),
    enabled: !!terminology && debounced.length > 0,
    staleTime: 30_000,
  })

  const valueStr = typeof value === 'string' ? value : ''
  const listed = terms.find((t) => t.value === valueStr)
  // The term search accepts the terminology's id, but the term lookup's field
  // form resolves only its value, so the lookup passes the value.
  const valueQuery = useQuery({
    queryKey: ['rc-console', 'term-field-value', terminologyId, valueStr],
    queryFn: () =>
      client.defStore.getTerm(valueStr, {
        terminology: terminology!.value,
        namespace: terminology!.namespace,
      }),
    enabled: !!terminology && !!valueStr && !isLoading && !listed,
    retry: false,
    staleTime: 60_000,
  })
  const selected = listed ?? valueQuery.data

  const searching = search.trim().length > 0
  const rows: TermRow[] = searching
    ? (searchQuery.data?.items ?? []).map((hit) => ({
        term: hit.term,
        matchedName: hit.matched_via === 'alias' ? hit.matched_value : null,
      }))
    : terms.map((term) => ({ term, matchedName: null }))
  const searchSettling = searching && (debounced !== search.trim() || searchQuery.isFetching)

  const handleSelect = useCallback(
    (v: string | null) => {
      onChange(v)
      setOpen(false)
      setSearch('')
    },
    [onChange],
  )

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

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setSearch('')
      } else if (e.key === 'Enter' && !searchSettling && rows.length === 1) {
        e.preventDefault()
        const first = rows[0]
        if (first) handleSelect(first.term.value)
      }
    },
    [rows, searchSettling, handleSelect],
  )

  if (!ref) {
    return (
      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
        No terminology_ref configured on this field.
      </div>
    )
  }

  if (unresolved) {
    return (
      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
        Terminology <span className="font-mono">{ref}</span> not found
        {namespace && ref.indexOf(':') < 0 && <> in namespace <span className="font-mono">{namespace}</span></>}.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 border rounded-md text-sm transition-colors bg-white',
          open ? 'border-primary/30 ring-1 ring-primary/20' : 'border-gray-200 hover:border-gray-300',
          disabled && 'bg-gray-50 cursor-not-allowed opacity-70',
        )}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <Tag size={12} className="text-orange-400 shrink-0" />
            <span className="text-gray-800 truncate">{selected.label || selected.value}</span>
            <span className="text-xs font-mono text-gray-400 truncate">{selected.value}</span>
            {selected.status !== 'active' && (
              <span className="text-[10px] text-amber-500">({selected.status})</span>
            )}
          </span>
        ) : valueStr ? (
          <span className="flex items-center gap-2 min-w-0">
            <Tag size={12} className="text-orange-400 shrink-0" />
            <span className="text-xs font-mono text-gray-500 truncate">{valueStr}</span>
            {valueQuery.error instanceof WipNotFoundError ? (
              <span className="text-[10px] text-amber-500">(not found)</span>
            ) : valueQuery.isError ? (
              <span className="text-[10px] text-amber-500">(lookup failed)</span>
            ) : null}
          </span>
        ) : (
          <span className="text-gray-400">
            {isLoading ? 'Loading terms...' : 'Select a term...'}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {valueStr && !disabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleSelect(null) }}
              className="text-gray-300 hover:text-gray-500"
              title="Clear"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown size={14} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-gray-100">
            <Search size={12} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search terms..."
              aria-label="Search terms"
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-300"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {searching && searchQuery.isError ? (
              <p role="alert" className="text-xs text-danger text-center py-3">
                Search failed: {searchQuery.error.message}
              </p>
            ) : isLoading || (searching && searchSettling && rows.length === 0) ? (
              <p className="text-xs text-gray-400 text-center py-3">{searching ? 'Searching...' : 'Loading...'}</p>
            ) : rows.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No terms match.</p>
            ) : (
              rows.map(({ term: t, matchedName }) => (
                <button
                  key={t.term_id}
                  type="button"
                  onClick={() => handleSelect(t.value)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors',
                    t.value === valueStr ? 'bg-primary/5 text-primary-dark' : 'hover:bg-gray-50 text-gray-700',
                  )}
                >
                  <Tag size={11} className="text-orange-400 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{t.label || t.value}</span>
                    {matchedName && (
                      <span className="block truncate text-[11px] text-gray-400">also known as {matchedName}</span>
                    )}
                  </span>
                  <span className="text-xs font-mono text-gray-400 shrink-0">{t.value}</span>
                </button>
              ))
            )}
          </div>
          {!searching && totalTerms > terms.length && (
            <div className="px-2.5 py-1 border-t border-gray-100 text-[10px] text-gray-500 bg-gray-50">
              Showing the first {terms.length} of {totalTerms} terms. Type to search all of them.
            </div>
          )}
          {searching && !searchSettling && searchQuery.data && searchQuery.data.total_matched > rows.length && (
            <div className="px-2.5 py-1 border-t border-gray-100 text-[10px] text-gray-500 bg-gray-50">
              Showing the best {rows.length} of {searchQuery.data.total_matched} matches. Refine the search to narrow them down.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The terminology `ref` names. Resolved against the terminology list first,
 * so a bare value lands in the document's namespace; an id that is not in the
 * list (an install with more terminologies than one page) is fetched directly.
 */
function useResolvedTerminology(
  ref: string,
  namespace?: string,
): { terminology: Terminology | undefined; unresolved: boolean } {
  const client = useWipClient()
  const { data: listData, isSuccess: listLoaded } = useTerminologies({ page_size: 1000 }, { enabled: !!ref })
  const fromList = useMemo(
    () => (ref ? resolveTerminologyRef(ref, listData?.items ?? [], namespace) : undefined),
    [ref, listData, namespace],
  )

  const direct = useQuery({
    queryKey: ['rc-console', 'terminology-ref', ref],
    queryFn: () => client.defStore.getTerminology(ref),
    enabled: !!ref && listLoaded && !fromList,
    retry: false,
    staleTime: 60_000,
  })
  // A bare value is fetched here only to cover ids; a terminology the platform
  // finds by that value in another namespace is not the one the field means.
  const fromDirect =
    direct.data && (direct.data.terminology_id === ref || ref.includes(':')) ? direct.data : undefined

  const terminology = fromList ?? fromDirect
  const unresolved = !terminology && (direct.isError || (direct.isSuccess && !fromDirect))
  return { terminology, unresolved }
}
