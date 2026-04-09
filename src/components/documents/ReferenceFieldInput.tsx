import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, Search, X, Link2, Layers, FolderTree, FileText } from 'lucide-react'
import { useDocuments, useTemplates, useTerms, useTerminologies } from '@wip/react'
import type { FieldDefinition, Document, Template, Term, Terminology } from '@wip/client'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// ReferenceFieldInput — polymorphic reference picker.
//
// `field.reference_type` dispatches between four sub-pickers:
//   - 'document'    — searchable over useDocuments (scoped by target_templates)
//   - 'term'        — searchable over useTerms per target_terminologies
//   - 'terminology' — searchable over useTerminologies
//   - 'template'    — searchable over useTemplates
//
// The form state stores the reference by its lookup_value (typically the
// entity's canonical `value` or ID string), which the server resolves to a
// full Reference{resolved,...} on save.
//
// v1: all four share the same combobox UI. Document ref picker uses
// pickDocLabel for friendly display. If multiple target_templates are
// configured we fetch each and merge.
// ---------------------------------------------------------------------------

export interface ReferenceFieldInputProps {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}

type Item = {
  id: string
  value: string
  label: string
  subLabel?: string
  icon: React.ReactNode
}

export default function ReferenceFieldInput(props: ReferenceFieldInputProps) {
  const { field } = props
  const refType = field.reference_type

  if (refType === 'document') return <DocumentRefPicker {...props} />
  if (refType === 'term') return <TermRefPicker {...props} />
  if (refType === 'terminology') return <TerminologyRefPicker {...props} />
  if (refType === 'template') return <TemplateRefPicker {...props} />

  return (
    <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
      No reference_type configured on this field.
    </div>
  )
}

// ---------------------------------------------------------------------------
// Document reference picker
// ---------------------------------------------------------------------------

// Pick a human-friendly label from a hydrated document. Matches the helper
// used on DocumentDetailPage so the UIs agree.
function pickDocLabel(doc: Document): string {
  const data = (doc.data ?? {}) as Record<string, unknown>
  for (const key of ['name', 'label', 'title', 'display_name', 'value']) {
    const v = data[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  if (doc.identity_hash) return doc.identity_hash.slice(0, 12)
  return doc.document_id.slice(0, 8)
}

function DocumentRefPicker({ field, value, onChange, disabled }: ReferenceFieldInputProps) {
  const targets = field.target_templates ?? []
  // If no targets configured, fall back to all documents (capped).
  const firstTarget = targets[0]

  // v1 simplification: only query the first target template. Most reference
  // fields constrain to exactly one template; supporting N templates would
  // require N useQueries calls which adds complexity. Surfaces a note if
  // there are more than one.
  const { data: templatesData } = useTemplates({ status: 'active', latest_only: true, page_size: 100 })
  const resolvedTemplateId = useMemo(() => {
    if (!firstTarget) return undefined
    const t = templatesData?.items ?? []
    const byId = t.find((x) => x.template_id === firstTarget)
    if (byId) return byId.template_id
    const byValue = t.find((x) => x.value === firstTarget)
    return byValue?.template_id
  }, [firstTarget, templatesData])

  const { data: docsData, isLoading } = useDocuments(
    {
      template_id: resolvedTemplateId,
      status: 'active',
      page_size: 50,
    },
    { enabled: !!resolvedTemplateId || !firstTarget },
  )

  const docs = docsData?.items ?? []
  const items: Item[] = docs.map((d) => ({
    id: d.document_id,
    value: d.document_id,
    label: pickDocLabel(d),
    subLabel: d.template_value || '',
    icon: <FileText size={12} className="text-gray-400 shrink-0" />,
  }))

  return (
    <Combobox
      items={items}
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      disabled={disabled}
      isLoading={isLoading}
      placeholder="Select a document..."
      emptyLabel="No documents match."
      footer={
        targets.length > 1
          ? `Showing docs from ${firstTarget}. Multi-template refs are v2.`
          : undefined
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Term reference picker (reference_type='term')
// ---------------------------------------------------------------------------

function TermRefPicker({ field, value, onChange, disabled }: ReferenceFieldInputProps) {
  const targets = field.target_terminologies ?? []
  const firstTarget = targets[0]

  const { data: terminologiesData } = useTerminologies({ page_size: 1000 })
  const resolvedTerminologyId = useMemo(() => {
    if (!firstTarget) return ''
    const items = terminologiesData?.items ?? []
    const byId = items.find((t) => t.terminology_id === firstTarget)
    if (byId) return byId.terminology_id
    const byValue = items.find((t) => t.value === firstTarget)
    return byValue?.terminology_id ?? ''
  }, [firstTarget, terminologiesData])

  const { data: termsData, isLoading } = useTerms(
    resolvedTerminologyId,
    { status: 'active', page_size: 1000 },
    { enabled: !!resolvedTerminologyId },
  )

  const items: Item[] = (termsData?.items ?? []).map((t: Term) => ({
    id: t.term_id,
    value: t.value,
    label: t.label || t.value,
    subLabel: t.value,
    icon: <Link2 size={11} className="text-orange-400 shrink-0" />,
  }))

  return (
    <Combobox
      items={items}
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      disabled={disabled}
      isLoading={isLoading}
      placeholder="Select a term..."
      emptyLabel="No terms match."
      footer={targets.length > 1 ? `Showing terms from ${firstTarget}.` : undefined}
    />
  )
}

// ---------------------------------------------------------------------------
// Terminology reference picker
// ---------------------------------------------------------------------------

function TerminologyRefPicker({ value, onChange, disabled }: ReferenceFieldInputProps) {
  const { data, isLoading } = useTerminologies({ page_size: 1000 })
  const items: Item[] = (data?.items ?? []).map((t: Terminology) => ({
    id: t.terminology_id,
    value: t.value,
    label: t.label || t.value,
    subLabel: t.value,
    icon: <FolderTree size={11} className="text-emerald-400 shrink-0" />,
  }))
  return (
    <Combobox
      items={items}
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      disabled={disabled}
      isLoading={isLoading}
      placeholder="Select a terminology..."
      emptyLabel="No terminologies match."
    />
  )
}

// ---------------------------------------------------------------------------
// Template reference picker
// ---------------------------------------------------------------------------

function TemplateRefPicker({ value, onChange, disabled }: ReferenceFieldInputProps) {
  const { data, isLoading } = useTemplates({ status: 'active', latest_only: true, page_size: 100 })
  const items: Item[] = (data?.items ?? []).map((t: Template) => ({
    id: t.template_id,
    value: t.value,
    label: t.label || t.value,
    subLabel: t.value,
    icon: <Layers size={11} className="text-indigo-400 shrink-0" />,
  }))
  return (
    <Combobox
      items={items}
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      disabled={disabled}
      isLoading={isLoading}
      placeholder="Select a template..."
      emptyLabel="No templates match."
    />
  )
}

// ---------------------------------------------------------------------------
// Shared combobox (used by all four reference pickers)
// ---------------------------------------------------------------------------

function Combobox({
  items,
  value,
  onChange,
  disabled,
  isLoading,
  placeholder,
  emptyLabel,
  footer,
}: {
  items: Item[]
  value: string
  onChange: (v: unknown) => void
  disabled?: boolean
  isLoading?: boolean
  placeholder: string
  emptyLabel: string
  footer?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = items.find((i) => i.value === value || i.id === value)

  const filtered = search
    ? items.filter((i) => {
        const s = search.toLowerCase()
        return i.label.toLowerCase().includes(s) || i.value.toLowerCase().includes(s)
      })
    : items

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
            <span className="text-[10px] text-amber-500">(not found)</span>
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
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-300"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {isLoading ? (
              <p className="text-xs text-gray-400 text-center py-3">Loading...</p>
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
                    i.value === value ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700',
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
          {footer && (
            <div className="px-2.5 py-1 border-t border-gray-100 text-[10px] text-amber-600 bg-amber-50">
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
