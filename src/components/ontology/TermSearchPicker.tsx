import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { useWipClient } from '@wip/react'
import { useQuery } from '@tanstack/react-query'
import type { Term } from '@wip/client'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// TermSearchPicker
//
// Reusable cross-terminology term search dropdown. Backed by
// `client.reporting.search({ types: ['term'], namespace? })`.
//
// Namespace handling:
//   - If `namespace` prop is set: search within that namespace only.
//   - If `namespace` is empty/undefined: omit it from the request, which the
//     backend treats as "all namespaces". This requires a privileged API key
//     (wip-admins / wip-services). Scoped keys will get an auth error.
//   - There is NO `_all` magic value — omitting the field is the contract.
//
// Search results from `reporting.search` don't include terminology context,
// so we hydrate the top results in parallel via `client.defStore.getTerm()`
// to get `terminology_id`, `terminology_value`, and `namespace`.
//
// Limitations:
//   - Hydration adds N parallel getTerm calls per debounced query — capped via
//     the `limit` prop (default 15) to keep this acceptable.
//
// Used by:
//   - Add Relationship slide-out (Term Detail page)
//   - (future) Document field auto-complete
// ---------------------------------------------------------------------------

export interface PickedTerm {
  term_id: string
  value: string
  label: string | null
  terminology_id: string
  terminology_value: string | null
  namespace: string
}

interface TermSearchPickerProps {
  /**
   * Namespace to search within. Empty/undefined = search across all namespaces
   * (requires a privileged API key — scoped keys will get an auth error).
   */
  namespace?: string
  /** Called when the user picks a term. */
  onSelect: (term: PickedTerm) => void
  /** Term IDs to exclude from results (e.g., the current term to prevent self-relationships). */
  excludeTermIds?: string[]
  /** Placeholder text. */
  placeholder?: string
  /** Max search results to fetch and hydrate. Default 15. */
  limit?: number
  /** Debounce in ms. Default 300. */
  debounceMs?: number
  /** Auto-focus the input on mount. */
  autoFocus?: boolean
  className?: string
}

export default function TermSearchPicker({
  namespace,
  onSelect,
  excludeTermIds,
  placeholder = 'Search terms across terminologies...',
  limit = 15,
  debounceMs = 300,
  autoFocus,
  className,
}: TermSearchPickerProps) {
  const client = useWipClient()

  const [input, setInput] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Debounce the input -> debounced query
  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebounced(input.trim()), debounceMs)
    return () => clearTimeout(debounceTimer.current)
  }, [input, debounceMs])

  // Search query — types=['term']. When `namespace` is empty, omit it from the
  // request so the backend treats it as "all namespaces" (privileged keys only).
  const searchQuery = useQuery({
    queryKey: ['rc-console', 'term-search', namespace || '_all', debounced, limit],
    queryFn: async () => {
      // Build params without `namespace` when empty. The TS type marks it as
      // required but the runtime accepts omission for cross-namespace search.
      const params: { query: string; types: string[]; limit: number; namespace?: string } = {
        query: debounced,
        types: ['term'],
        limit,
      }
      if (namespace) params.namespace = namespace
      const res = await client.reporting.search(params as Parameters<typeof client.reporting.search>[0])
      const termHits = res.results.filter(r => r.type === 'term')
      // Hydrate in parallel to get terminology_id / terminology_value / namespace
      const hydrated = await Promise.all(
        termHits.map(async (hit): Promise<PickedTerm | null> => {
          try {
            const full: Term = await client.defStore.getTerm(hit.id)
            return {
              term_id: full.term_id,
              value: full.value,
              label: full.label ?? hit.label,
              terminology_id: full.terminology_id,
              terminology_value: full.terminology_value ?? null,
              namespace: full.namespace,
            }
          } catch {
            return null
          }
        })
      )
      return hydrated.filter((t): t is PickedTerm => t !== null)
    },
    enabled: open && debounced.length > 0,
    staleTime: 30_000,
  })

  const excludeSet = new Set(excludeTermIds ?? [])
  const results = (searchQuery.data ?? []).filter(t => !excludeSet.has(t.term_id))

  // Reset highlight when results change
  useEffect(() => {
    setHighlight(0)
  }, [results.length])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const handlePick = useCallback(
    (term: PickedTerm) => {
      onSelect(term)
      setInput('')
      setDebounced('')
      setOpen(false)
    },
    [onSelect]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight(h => Math.min(h + 1, Math.max(results.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = results[highlight]
      if (pick) handlePick(pick)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const handleClear = () => {
    setInput('')
    setDebounced('')
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => {
            setInput(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
        />
        {searchQuery.isFetching && (
          <Loader2 size={14} className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
        )}
        {input && !searchQuery.isFetching && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-auto">
          {debounced.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">
              Type to search terms in{' '}
              {namespace ? (
                <>
                  namespace <span className="font-mono">{namespace}</span>
                </>
              ) : (
                <span className="italic">all namespaces</span>
              )}
            </div>
          )}
          {debounced.length > 0 && searchQuery.isError && (
            <div className="px-3 py-2 text-xs text-red-600">
              Search failed: {(searchQuery.error as Error).message}
            </div>
          )}
          {debounced.length > 0 && !searchQuery.isError && results.length === 0 && !searchQuery.isFetching && (
            <div className="px-3 py-2 text-xs text-gray-500">No matching terms</div>
          )}
          {results.map((term, i) => (
            <button
              key={term.term_id}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={e => {
                e.preventDefault() // keep input from blurring before click fires
                handlePick(term)
              }}
              className={cn(
                'w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0',
                i === highlight ? 'bg-blue-50' : 'hover:bg-gray-50'
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-sm text-gray-900 truncate">
                  {term.label || term.value}
                </div>
                <div className="text-xs font-mono text-gray-500 shrink-0">{term.value}</div>
              </div>
              <div className="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-1.5">
                <span>{term.terminology_value ?? term.terminology_id}</span>
                {!namespace && (
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono text-[10px]">
                    {term.namespace}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
