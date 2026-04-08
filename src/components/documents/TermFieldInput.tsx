import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, Search, X, Tag } from 'lucide-react'
import { useTerms, useTerminologies } from '@wip/react'
import type { FieldDefinition } from '@wip/client'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// TermFieldInput — searchable combobox over a terminology's terms.
//
// `field.terminology_ref` may be either a terminology_id (UUID) or a
// terminology value (UPPER_SNAKE). We resolve via useTerminologies() and
// then load up to 100 terms via useTerms().
//
// The form state stores the term's `value` (not its ID) — that's what the
// Document schema expects for `term` fields (it resolves to a TermReference
// on the server side). See the WIP data model for details.
//
// v1 cap: 100 terms per terminology. Beyond that, we'd need a debounced
// search + TermSearchPicker. Tracked in KNOWN_ISSUES.
// ---------------------------------------------------------------------------

export interface TermFieldInputProps {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}

export default function TermFieldInput({ field, value, onChange, disabled }: TermFieldInputProps) {
  // Resolve terminology_ref → terminology_id
  const ref = field.terminology_ref ?? ''
  const { data: terminologiesData } = useTerminologies({ page_size: 200 })
  const resolvedTerminologyId = useMemo(() => {
    if (!ref) return ''
    const items = terminologiesData?.items ?? []
    const byId = items.find((t) => t.terminology_id === ref)
    if (byId) return byId.terminology_id
    const byValue = items.find((t) => t.value === ref)
    return byValue?.terminology_id ?? ''
  }, [ref, terminologiesData])

  const { data: termsData, isLoading } = useTerms(
    resolvedTerminologyId,
    { status: 'active', page_size: 100 },
    { enabled: !!resolvedTerminologyId },
  )

  const terms = termsData?.items ?? []
  const valueStr = typeof value === 'string' ? value : ''
  const selected = terms.find((t) => t.value === valueStr)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = search
    ? terms.filter((t) => {
        const s = search.toLowerCase()
        return (
          t.value.toLowerCase().includes(s) ||
          (t.label?.toLowerCase().includes(s) ?? false)
        )
      })
    : terms

  const handleSelect = (v: string | null) => {
    onChange(v)
    setOpen(false)
    setSearch('')
  }

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
      } else if (e.key === 'Enter' && filtered.length === 1) {
        const first = filtered[0]
        if (first) handleSelect(first.value)
      }
    },
    [filtered],
  )

  if (!ref) {
    return (
      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
        No terminology_ref configured on this field.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 border rounded-md text-sm transition-colors bg-white',
          open ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300',
          disabled && 'bg-gray-50 cursor-not-allowed opacity-70',
        )}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <Tag size={12} className="text-orange-400 shrink-0" />
            <span className="text-gray-800 truncate">{selected.label || selected.value}</span>
            <span className="text-xs font-mono text-gray-400 truncate">{selected.value}</span>
          </span>
        ) : valueStr ? (
          <span className="flex items-center gap-2 min-w-0">
            <Tag size={12} className="text-orange-400 shrink-0" />
            <span className="text-xs font-mono text-gray-500 truncate">{valueStr}</span>
            <span className="text-[10px] text-amber-500">(not found)</span>
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
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-300"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {isLoading ? (
              <p className="text-xs text-gray-400 text-center py-3">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No terms match.</p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.term_id}
                  type="button"
                  onClick={() => handleSelect(t.value)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors',
                    t.value === valueStr ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700',
                  )}
                >
                  <Tag size={11} className="text-orange-400 shrink-0" />
                  <span className="flex-1 truncate">{t.label || t.value}</span>
                  <span className="text-xs font-mono text-gray-400 shrink-0">{t.value}</span>
                </button>
              ))
            )}
          </div>
          {terms.length >= 100 && (
            <div className="px-2.5 py-1 border-t border-gray-100 text-[10px] text-amber-600 bg-amber-50">
              Showing first 100 terms. Scoped search is a v2 feature.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
