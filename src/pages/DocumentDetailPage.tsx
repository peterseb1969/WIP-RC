import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  FileText,
  ArrowLeft,
  Layers,
  Calendar,
  User,
  Clock,
  Copy,
  Check,
  ChevronDown,
  FolderTree,
  FileCode2,
  Hash,
  Link2,
  Tag,
  Pencil,
} from 'lucide-react'
import { useDocument, useDocumentVersions, useTemplateByValue, useWipClient } from '@wip/react'
import { useQueries } from '@tanstack/react-query'
import type { FieldDefinition, TermReference, Reference, Term } from '@wip/client'
import JsonViewer from '@/components/common/JsonViewer'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/cn'


// ---------------------------------------------------------------------------
// Copy button (inline, small)
// ---------------------------------------------------------------------------

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCopyable(val: unknown): boolean {
  if (typeof val !== 'string') return false
  const s = val as string
  if (s.length > 200 || s.length === 0) return false
  // UUIDs, IDs, short codes, template values, enum-like values
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true
  if (/^[A-Z][A-Z0-9_]+$/.test(s)) return true // UPPER_SNAKE_CASE
  if (s.length < 80 && !s.includes('\n')) return true // short single-line strings
  return false
}

function isSimpleArray(val: unknown): boolean {
  if (!Array.isArray(val)) return false
  return val.every(item => typeof item === 'string' || typeof item === 'number')
}

// ---------------------------------------------------------------------------
// Term-resolved field value
// ---------------------------------------------------------------------------

function TermFieldValue({ value }: { terminologyRef: string; value: string }) {
  // terminologyRef can be either an ID (UUID) or a value (UPPER_SNAKE)
  // useTerms needs a terminology ID — if it's a value, we can't easily resolve here
  // For now, show the raw value but styled as a term pill
  return (
    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">
      {value}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Array as pills
// ---------------------------------------------------------------------------

function ArrayPills({ items }: { items: (string | number)[] }) {
  if (items.length === 0) return <span className="text-gray-400 text-sm">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
          {String(item)}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single data field row
// ---------------------------------------------------------------------------

function FieldRow({
  fieldName,
  value,
  fieldDef,
}: {
  fieldName: string
  value: unknown
  fieldDef?: FieldDefinition
}) {
  const label = fieldDef?.label || fieldName
  const fieldType = fieldDef?.type

  // Term field — show as pill
  if (fieldType === 'term' && typeof value === 'string' && fieldDef?.terminology_ref) {
    return (
      <div className="flex items-start gap-3 px-4 py-2.5">
        <span className="text-sm text-gray-500 shrink-0 min-w-[140px]">
          {label}
          {fieldDef.mandatory && <span className="text-red-400 ml-0.5">*</span>}
        </span>
        <div className="flex items-center gap-1.5">
          <TermFieldValue terminologyRef={fieldDef.terminology_ref} value={value} />
          <CopyButton value={value} />
        </div>
      </div>
    )
  }

  // Simple array — show as pills
  if (isSimpleArray(value)) {
    return (
      <div className="flex items-start gap-3 px-4 py-2.5">
        <span className="text-sm text-gray-500 shrink-0 min-w-[140px]">
          {label}
          {fieldDef?.mandatory && <span className="text-red-400 ml-0.5">*</span>}
        </span>
        <ArrayPills items={value as (string | number)[]} />
      </div>
    )
  }

  // Complex object/array — JsonViewer
  if (typeof value === 'object' && value !== null) {
    return (
      <div className="flex items-start gap-3 px-4 py-2.5">
        <span className="text-sm text-gray-500 shrink-0 min-w-[140px]">
          {label}
          {fieldDef?.mandatory && <span className="text-red-400 ml-0.5">*</span>}
        </span>
        <div className="flex-1 min-w-0">
          <JsonViewer data={value} maxHeight="200px" collapsed />
        </div>
      </div>
    )
  }

  // Scalar value
  const display = formatFieldValue(value)
  const showCopy = isCopyable(value)

  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className="text-sm text-gray-500 shrink-0 min-w-[140px]">
        {label}
        {fieldDef?.mandatory && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      <div className="flex items-center gap-1.5 text-sm text-gray-800 break-all">
        <span>{display}</span>
        {showCopy && <CopyButton value={String(value)} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 mb-2 group"
      >
        <ChevronDown size={14} className={cn('text-gray-400 transition-transform', !open && '-rotate-90')} />
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-700 transition-colors">{title}</h2>
      </button>
      {open && children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Term references — hydrates each term_id via getTerm to show real labels
// and link to TermDetailPage.
// ---------------------------------------------------------------------------

function TermReferencesList({ refs }: { refs: TermReference[] }) {
  const client = useWipClient()
  const queries = useQueries({
    queries: refs.map(ref => ({
      queryKey: ['rc-console', 'doc-term-ref', ref.term_id],
      queryFn: () => client.defStore.getTerm(ref.term_id),
      enabled: !!ref.term_id,
      staleTime: 60_000,
    })),
  })

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
      {refs.map((ref, i) => {
        const q = queries[i]
        const term = q?.data as Term | undefined
        return (
          <div key={`${ref.field_path}-${ref.term_id}-${i}`} className="flex items-center gap-3 px-4 py-2">
            <Tag size={12} className="text-orange-400 shrink-0" />
            <span className="text-xs text-gray-500 min-w-[120px] font-mono">{ref.field_path}</span>
            {term ? (
              <Link
                to={`/terminologies/${term.terminology_id}/terms/${term.term_id}`}
                className="inline-flex items-center gap-1.5 text-sm text-gray-800 hover:text-blue-600 hover:underline"
              >
                <span>{term.label || term.value}</span>
                <span className="text-xs font-mono text-gray-400">{term.value}</span>
              </Link>
            ) : q?.isLoading ? (
              <span className="text-xs text-gray-400">loading...</span>
            ) : (
              <span className="text-xs font-mono text-gray-400">{ref.term_id}</span>
            )}
            {term?.terminology_value && (
              <span className="text-[10px] font-mono text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">
                {term.terminology_value}
              </span>
            )}
            {ref.matched_via && (
              <span className="text-[10px] text-gray-400">via {ref.matched_via}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generic references — document/term/terminology/template — show resolved
// labels and link to the right detail page where possible.
// ---------------------------------------------------------------------------

function ReferencesList({ refs }: { refs: Reference[] }) {
  const client = useWipClient()
  // Hydrate each document reference to extract a human-readable label.
  const docQueries = useQueries({
    queries: refs.map(ref => ({
      queryKey: ['rc-console', 'doc-ref', ref.resolved?.document_id ?? ''],
      queryFn: () => client.documents.getDocument(ref.resolved!.document_id!),
      enabled: ref.reference_type === 'document' && !!ref.resolved?.document_id,
      staleTime: 60_000,
    })),
  })

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
      {refs.map((ref, i) => {
        const docQ = docQueries[i]
        return (
          <ReferenceRow
            key={`${ref.field_path}-${i}`}
            ref_={ref}
            hydratedDoc={docQ?.data}
            isLoadingDoc={docQ?.isLoading ?? false}
          />
        )
      })}
    </div>
  )
}

// Pick a human-friendly label from a hydrated document. Tries common name
// fields in `data`, then falls back to a short identity hash.
function pickDocLabel(doc: import('@wip/client').Document): string {
  const data = (doc.data ?? {}) as Record<string, unknown>
  for (const key of ['name', 'label', 'title', 'display_name', 'value']) {
    const v = data[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  if (doc.identity_hash) return doc.identity_hash.slice(0, 12)
  return doc.document_id.slice(0, 8)
}

function ReferenceRow({
  ref_,
  hydratedDoc,
  isLoadingDoc,
}: {
  ref_: Reference
  hydratedDoc?: import('@wip/client').Document
  isLoadingDoc: boolean
}) {
  const r = ref_.resolved ?? {}

  // Build the link target + display label based on reference_type.
  let to: string | null = null
  let label: string = ref_.lookup_value
  let sublabel: string | null = null
  let mono = true

  if (ref_.reference_type === 'document' && r.document_id) {
    const tv = hydratedDoc?.template_value ?? r.template_value ?? '_'
    to = `/documents/${tv}/${r.document_id}`
    if (hydratedDoc) {
      label = pickDocLabel(hydratedDoc)
      mono = false
      sublabel = hydratedDoc.template_value || tv
    } else if (isLoadingDoc) {
      label = 'loading...'
      mono = false
    } else {
      label = r.document_id.slice(0, 8) + '…'
    }
  } else if (ref_.reference_type === 'term' && r.term_id && r.terminology_id) {
    to = `/terminologies/${r.terminology_id}/terms/${r.term_id}`
    label = ref_.lookup_value || r.term_id
    mono = !ref_.lookup_value
  } else if (ref_.reference_type === 'terminology' && r.terminology_id) {
    to = `/terminologies/${r.terminology_id}`
    label = r.terminology_value || ref_.lookup_value
    mono = false
  } else if (ref_.reference_type === 'template' && r.template_id) {
    to = `/templates/${r.template_id}`
    label = r.template_value || ref_.lookup_value
    mono = false
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <Link2 size={12} className="text-pink-400 shrink-0" />
      <span className="text-xs text-gray-500 min-w-[120px] font-mono">{ref_.field_path}</span>
      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
        {ref_.reference_type}
      </span>
      {to ? (
        <Link
          to={to}
          className={cn(
            'text-sm text-gray-800 hover:text-blue-600 hover:underline truncate',
            mono && 'font-mono text-xs'
          )}
        >
          {label}
        </Link>
      ) : (
        <span className={cn('text-sm text-gray-700 truncate', mono && 'font-mono text-xs')}>
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-[10px] font-mono text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded">
          {sublabel}
        </span>
      )}
      {r.version != null && (
        <span className="text-[10px] text-gray-400">v{r.version}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Document Detail Page
// ---------------------------------------------------------------------------

export default function DocumentDetailPage() {
  const { templateValue, id } = useParams()
  const { data: doc, isLoading, error } = useDocument(id ?? '')
  const { data: versions } = useDocumentVersions(id ?? '')
  const { data: template } = useTemplateByValue(templateValue ?? '')

  if (isLoading) return <LoadingState label="Loading document..." />
  if (error) return <ErrorState message={error.message} />
  if (!doc) return <ErrorState message="Document not found" />

  const docData = (doc.data ?? {}) as Record<string, unknown>
  const fieldMap = new Map<string, FieldDefinition>(
    (template?.fields ?? []).map(f => [f.name, f])
  )

  const templateLabel = template?.label || template?.value || templateValue || doc.template_id

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          to="/documents"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 mb-2"
        >
          <ArrowLeft size={12} />
          Back to Documents
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
          <FileText size={24} className="text-gray-400" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
              {doc.document_id}
              <CopyButton value={doc.document_id} />
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <Link
                to={`/templates/${template?.template_id ?? ''}${doc.namespace ? `?ns=${doc.namespace}` : ''}`}
                className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"
              >
                <FileCode2 size={10} />
                {templateLabel}
                {doc.template_version != null && (
                  <span className="text-gray-400">v{doc.template_version}</span>
                )}
              </Link>
              {doc.namespace && (
                <Link
                  to={`/?ns=${doc.namespace}`}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 bg-gray-100 px-1.5 py-0.5 rounded"
                >
                  <FolderTree size={10} />
                  {doc.namespace}
                </Link>
              )}
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Layers size={10} /> v{doc.version ?? 1}
              </span>
              <StatusBadge status={doc.status === 'active' ? 'active' : 'inactive'} label={doc.status} />
            </div>
          </div>
          </div>
          {/* Action cluster */}
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {doc.status === 'active' && templateValue && (
              <Link
                to={`/documents/${templateValue}/${doc.document_id}/edit`}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <Pencil size={12} />
                Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
        {doc.identity_hash && (
          <span className="flex items-center gap-1 font-mono" title="Identity hash">
            <Hash size={10} /> {doc.identity_hash!.slice(0, 12)}...
            <CopyButton value={doc.identity_hash!} />
          </span>
        )}
        {doc.created_at && (
          <span className="flex items-center gap-1">
            <Calendar size={10} /> Created: {new Date(doc.created_at).toLocaleString()}
          </span>
        )}
        {doc.created_by && (
          <span className="flex items-center gap-1">
            <User size={10} /> {doc.created_by}
          </span>
        )}
        {doc.updated_at && doc.updated_at !== doc.created_at && (
          <span className="flex items-center gap-1">
            <Clock size={10} /> Updated: {new Date(doc.updated_at).toLocaleString()}
          </span>
        )}
        {doc.updated_by && (
          <span className="flex items-center gap-1">
            <User size={10} /> updated by {doc.updated_by}
          </span>
        )}
        {doc.is_latest_version === false && doc.latest_version != null && (
          <span className="text-amber-500">Not latest (v{doc.latest_version} available)</span>
        )}
      </div>

      {/* Document metadata (source_system, warnings) */}
      {(() => {
        const meta = doc.metadata
        if (!meta) return null
        if (!meta.source_system && !meta.warnings?.length && !meta.custom) return null
        return (
          <div className="text-xs space-y-1">
            {meta.source_system && (
              <span className="text-gray-500">Source: <span className="text-gray-700">{meta.source_system}</span></span>
            )}
            {meta.warnings && meta.warnings.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {meta.warnings.map((w, i) => (
                  <span key={i} className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px]">{w}</span>
                ))}
              </div>
            )}
            {meta.custom && Object.keys(meta.custom).length > 0 && (
              <JsonViewer data={meta.custom} maxHeight="100px" collapsed />
            )}
          </div>
        )
      })()}

      {/* Data fields */}
      <CollapsibleSection title={`Data${template ? ` (${template.fields?.length ?? 0} fields)` : ''}`}>
        {Object.keys(docData).length === 0 ? (
          <p className="text-sm text-gray-400">No data fields.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {Object.entries(docData).map(([key, val]) => (
              <FieldRow key={key} fieldName={key} value={val} fieldDef={fieldMap.get(key)} />
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Term References */}
      {doc.term_references && doc.term_references.length > 0 && (
        <CollapsibleSection title={`Term References (${doc.term_references.length})`} defaultOpen={false}>
          <TermReferencesList refs={doc.term_references} />
        </CollapsibleSection>
      )}

      {/* References */}
      {doc.references && doc.references.length > 0 && (
        <CollapsibleSection title={`References (${doc.references.length})`} defaultOpen={false}>
          <ReferencesList refs={doc.references} />
        </CollapsibleSection>
      )}

      {/* File References */}
      {(() => {
        const refs = doc.file_references
        if (!refs?.length) return null
        return (
          <CollapsibleSection title={`File References (${refs.length})`} defaultOpen={false}>
            <div className="bg-white border border-gray-200 rounded-lg">
              <JsonViewer data={refs} maxHeight="200px" collapsed />
            </div>
          </CollapsibleSection>
        )
      })()}

      {/* Raw JSON — collapsed by default */}
      <CollapsibleSection title="Raw Document" defaultOpen={false}>
        <JsonViewer data={doc} maxHeight="400px" collapsed />
      </CollapsibleSection>

      {/* Version History */}
      {versions && versions.versions.length > 1 && (
        <CollapsibleSection title={`Version History (${versions.versions.length} versions)`}>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {versions.versions.map(v => (
              <div
                key={v.version}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5',
                  v.version === doc.version && 'bg-blue-50/50'
                )}
              >
                <Layers size={14} className="text-gray-300" />
                <span className="text-sm font-medium text-gray-700">Version {v.version}</span>
                {v.version === doc.version && (
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">current</span>
                )}
                {v.created_at && (
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(v.created_at).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  return String(val)
}
