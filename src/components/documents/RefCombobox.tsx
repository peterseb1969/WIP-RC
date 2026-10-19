import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search, X, Link2 } from 'lucide-react'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// RefCombobox — the dropdown shared by the reference pickers.
//
// By default it filters `items` in the browser by label and value. A picker
// that searches on the server passes `search` + `onSearchChange` instead: the
// combobox then shows `items` as given and leaves the filtering to the caller.
// ---------------------------------------------------------------------------

export type RefItem = {
  id: string
  value: string
  label: string
  subLabel?: string
  icon: React.ReactNode
}

export interface RefComboboxProps {
  items: RefItem[]
  value: string
  onChange: (v: unknown) => void
  disabled?: boolean
  isLoading?: boolean
  placeholder: string
  emptyLabel: string
  /** Notes under the list (limits, partial results). */
  footer?: React.ReactNode
  /** The stored value's item when it is not among `items`. */
  selectedItem?: RefItem
  /** Shown next to a stored value that matches no item (default "not found"). */
  unmatchedNote?: string
  /** Controlled search text: the caller filters `items` (server-side search). */
  search?: string
  onSearchChange?: (s: string) => void
  /** The caller's search is still running; Enter does not pick yet. */
  searching?: boolean
  /** Shown in the list instead of the items, e.g. a failed search. */
  listMessage?: React.ReactNode
  /** id for the trigger button, so the field's <label htmlFor> names it. */
  id?: string
}

/** Searchable single-value dropdown for the reference pickers (see header above). */
export default function RefCombobox({
  items,
  value,
  onChange,
  disabled,
  isLoading,
  placeholder,
  emptyLabel,
  footer,
  selectedItem,
  unmatchedNote = 'not found',
  search: controlledSearch,
  onSearchChange,
  searching,
  listMessage,
  id,
}: RefComboboxProps) {
  const [open, setOpen] = useState(false)
  const [localSearch, setLocalSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const controlled = onSearchChange !== undefined
  const search = controlled ? controlledSearch ?? '' : localSearch
  const setSearch = useCallback(
    (s: string) => (controlled ? onSearchChange(s) : setLocalSearch(s)),
    [controlled, onSearchChange],
  )

  const selected = items.find((i) => i.value === value || i.id === value) ?? selectedItem

  const filtered = !controlled && search
    ? items.filter((i) => {
        const s = search.toLowerCase()
        return i.label.toLowerCase().includes(s) || i.value.toLowerCase().includes(s)
      })
    : items

  const handleSelect = useCallback(
    (v: string | null) => {
      onChange(v)
      setOpen(false)
      setSearch('')
    },
    [onChange, setSearch],
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
  }, [open, setSearch])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setSearch('')
      } else if (e.key === 'Enter' && !searching && filtered.length === 1) {
        e.preventDefault()
        const first = filtered[0]
        if (first) handleSelect(first.value)
      }
    },
    [filtered, searching, handleSelect, setSearch],
  )

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
            {selected.icon}
            <span className="text-gray-800 truncate">{selected.label}</span>
            {selected.subLabel && (
              <span className="text-xs font-mono text-gray-400 truncate">{selected.subLabel}</span>
            )}
          </span>
        ) : value ? (
          <span className="flex items-center gap-2 min-w-0">
            <Link2 size={12} className="text-pink-400 shrink-0" />
            <span className="text-xs font-mono text-gray-500 truncate">{value}</span>
            {unmatchedNote && <span className="text-[10px] text-amber-500">({unmatchedNote})</span>}
          </span>
        ) : (
          <span className="text-gray-400">{isLoading ? 'Loading...' : placeholder}</span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
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
              placeholder="Search..."
              aria-label="Search"
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-300"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {listMessage ? (
              listMessage
            ) : isLoading || (searching && filtered.length === 0) ? (
              <p className="text-xs text-gray-400 text-center py-3">{searching ? 'Searching...' : 'Loading...'}</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">{emptyLabel}</p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => handleSelect(i.value)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors',
                    i.value === value ? 'bg-primary/5 text-primary-dark' : 'hover:bg-gray-50 text-gray-700',
                  )}
                >
                  {i.icon}
                  <span className="flex-1 truncate">{i.label}</span>
                  {i.subLabel && (
                    <span className="text-xs font-mono text-gray-400 shrink-0 truncate max-w-[40%]">
                      {i.subLabel}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          {footer}
        </div>
      )}
    </div>
  )
}

/** A note under a reference picker's list; `warn` for something the user should act on. */
export function RefFooterNote({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <div
      className={cn(
        'px-2.5 py-1 border-t border-gray-100 text-[10px]',
        warn ? 'text-amber-600 bg-amber-50' : 'text-gray-500 bg-gray-50',
      )}
    >
      {children}
    </div>
  )
}
