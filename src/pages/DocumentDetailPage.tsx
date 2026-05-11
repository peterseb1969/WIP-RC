import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
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
  Archive,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Network,
  ArrowRight,
} from 'lucide-react'
import { useDocument, useDocumentVersions, useTemplateByValue, useWipClient, useArchiveDocument } from '@wip/react'
import { useQueries } from '@tanstack/react-query'
import type { FieldDefinition, TermReference, Reference, Term } from '@wip/client'
import JsonViewer from '@/components/common/JsonViewer'
import RelationshipsPanel from '@/components/documents/RelationshipsPanel'
import TraversalPanel from '@/components/documents/TraversalPanel'
import PeerHeader from '@/components/documents/PeerHeader'
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
      {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
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
          {fieldDef.mandatory && <span className="text-danger/60 ml-0.5">*</span>}
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
          {fieldDef?.mandatory && <span className="text-danger/60 ml-0.5">*</span>}
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
          {fieldDef?.mandatory && <span className="text-danger/60 ml-0.5">*</span>}
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
        {fieldDef?.mandatory && <span className="text-danger/60 ml-0.5">*</span>}
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
                className="inline-flex items-center gap-1.5 text-sm text-gray-800 hover:text-primary hover:underline"
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
            'text-sm text-gray-800 hover:text-primary hover:underline truncate',
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
// Relationship Endpoints Header — shown only when the document's template
// has usage='relationship'. Resolves source_ref / target_ref from the
// document's references list and links to the endpoint docs.
// ---------------------------------------------------------------------------

function RelationshipEndpointsHeader({ refs }: { refs: Reference[] }) {
  const client = useWipClient()
  const sourceRef = refs.find(r => r.field_path === 'source_ref' && r.reference_type === 'document')
  const targetRef = refs.find(r => r.field_path === 'target_ref' && r.reference_type === 'document')

  // Hydrate both endpoint docs (if resolved) for human-readable labels
  const queries = useQueries({
    queries: [sourceRef, targetRef].map(ref => ({
      queryKey: ['rc-console', 'doc-ref', ref?.resolved?.document_id ?? ''],
      queryFn: () => client.documents.getDocument(ref!.resolved!.document_id!),
      enabled: !!ref?.resolved?.document_id,
      staleTime: 60_000,
    })),
  })
  const [sourceQ, targetQ] = queries

  // CASE-347 Phase 2 — also hydrate each endpoint's template so we can
  // honour template.header_fields when rendering the endpoint chip.
  // The hydrated docs above carry template_id; we fetch by that id.
  const templateQueries = useQueries({
    queries: [sourceQ?.data, targetQ?.data].map(doc => ({
      queryKey: ['rc-console', 'tmpl-for-endpoint', doc?.template_id ?? ''],
      queryFn: () => client.templates.getTemplate(doc!.template_id),
      enabled: !!doc?.template_id,
      staleTime: 300_000,
    })),
  })
  const [sourceTmplQ, targetTmplQ] = templateQueries

  return (
    <div className="bg-purple-50/60 border border-purple-200 rounded-lg p-3 flex items-center gap-3">
      <Network size={16} className="text-purple-600 shrink-0" />
      <EndpointChip label="From" ref_={sourceRef} hydratedDoc={sourceQ?.data} hydratedTemplate={sourceTmplQ?.data} loading={sourceQ?.isLoading ?? false} />
      <ArrowRight size={14} className="text-purple-400 shrink-0" />
      <EndpointChip label="To" ref_={targetRef} hydratedDoc={targetQ?.data} hydratedTemplate={targetTmplQ?.data} loading={targetQ?.isLoading ?? false} />
    </div>
  )
}

function EndpointChip({
  label,
  ref_,
  hydratedDoc,
  hydratedTemplate,
  loading,
}: {
  label: string
  ref_?: Reference
  hydratedDoc?: import('@wip/client').Document
  hydratedTemplate?: import('@wip/client').Template
  loading: boolean
}) {
  if (!ref_) {
    return (
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-purple-700 font-semibold">{label}</div>
        <div className="text-xs text-gray-400 italic">missing</div>
      </div>
    )
  }
  const r = ref_.resolved ?? {}
  const tv = hydratedDoc?.template_value ?? r.template_value ?? '_'
  const docId = r.document_id
  const display = hydratedDoc ? pickDocLabel(hydratedDoc) : (loading ? 'loading…' : (docId ? docId.slice(0, 12) + '…' : ref_.lookup_value))
  const subLabel = hydratedDoc?.template_value || r.template_value
  // CASE-347 Phase 2 — when both doc and its template are hydrated AND
  // the template declares header_fields (or has identity_fields as a
  // fallback), render via PeerHeader. Otherwise stay on pickDocLabel.
  const headerFields = hydratedTemplate?.header_fields ?? []
  const identityFields = hydratedTemplate?.identity_fields ?? []
  const useRichHeader = hydratedDoc && (headerFields.length > 0 || identityFields.length > 0)

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-purple-700 font-semibold">{label}</div>
      <div className="flex items-center gap-2 min-w-0">
        {docId ? (
          <Link to={`/documents/${tv}/${docId}`} className="hover:underline min-w-0">
            {useRichHeader ? (
              <PeerHeader
                data={hydratedDoc.data as Record<string, unknown>}
                metadata={hydratedDoc.metadata as unknown as Record<string, unknown>}
                headerFields={headerFields}
                identityFields={identityFields}
                fallbackLabel={display}
                compact
              />
            ) : (
              <span className="text-sm text-gray-800 truncate">{display}</span>
            )}
          </Link>
        ) : (
          <span className="text-sm text-danger">unresolved</span>
        )}
        {subLabel && (
          <span className="text-[10px] font-mono text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded shrink-0">
            {subLabel}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Document Detail Page
// ---------------------------------------------------------------------------

export default function DocumentDetailPage() {
  const { templateValue, id } = useParams()
  const navigate = useNavigate()
  const { data: doc, isLoading, error } = useDocument(id ?? '')
  const { data: versions } = useDocumentVersions(id ?? '')
  const { data: template } = useTemplateByValue(templateValue ?? '')
  const client = useWipClient()
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: Array<{ field: string | null; message: string }>; warnings: string[] } | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const archiveDoc = useArchiveDocument({
    onSuccess: () => {
      setConfirmArchive(false)
      navigate(`/documents?template=${templateValue ?? ''}`)
    },
    onError: (err) => setArchiveError(err.message),
  })

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
          to={`/documents?template=${templateValue}`}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary mb-2"
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
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary bg-gray-100 px-1.5 py-0.5 rounded"
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
            <button
              type="button"
              disabled={validating || !template}
              onClick={async () => {
                if (!template || !doc.namespace) return
                setValidating(true)
                setValidationResult(null)
                try {
                  const result = await client.documents.validateDocument({
                    template_id: template.template_id,
                    namespace: doc.namespace,
                    data: (doc.data ?? {}) as Record<string, unknown>,
                  })
                  setValidationResult({ valid: result.valid, errors: result.errors, warnings: result.warnings })
                } catch (err: unknown) {
                  setValidationResult({ valid: false, errors: [{ field: null, message: err instanceof Error ? err.message : String(err) }], warnings: [] })
                } finally {
                  setValidating(false)
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
              title="Validate this document against its template"
            >
              <ShieldCheck size={12} />
              {validating ? 'Validating…' : 'Validate'}
            </button>
            {doc.status === 'active' && !confirmArchive && (
              <button
                type="button"
                onClick={() => { setArchiveError(null); setConfirmArchive(true) }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-amber-700 border border-amber-200 rounded-md hover:bg-amber-50"
              >
                <Archive size={12} />
                Archive
              </button>
            )}
            {confirmArchive && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 mr-1">Archive?</span>
                <button
                  type="button"
                  onClick={() => archiveDoc.mutate({ id: doc.document_id, archivedBy: 'rc-console' })}
                  disabled={archiveDoc.isPending}
                  className="px-2 py-1 text-xs text-white bg-amber-500 hover:bg-amber-600 rounded-md disabled:opacity-60"
                >
                  {archiveDoc.isPending ? 'Archiving…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmArchive(false); setArchiveError(null) }}
                  disabled={archiveDoc.isPending}
                  className="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
        {archiveError && (
          <div className="mt-2 text-xs text-danger bg-danger/5 border border-danger/20 rounded-md px-2.5 py-1.5">
            Archive failed: {archiveError}
          </div>
        )}
      </div>

      {/* Relationship endpoints — shown only when this document is a relationship instance */}
      {template?.usage === 'relationship' && doc.references && (
        <RelationshipEndpointsHeader refs={doc.references} />
      )}

      {/* Validation result */}
      {validationResult && (
        <div className={cn(
          'flex items-start gap-2 text-xs rounded-lg px-3 py-2 border',
          validationResult.valid
            ? 'bg-success/5 border-success/20 text-success'
            : 'bg-danger/5 border-danger/20 text-danger'
        )}>
          {validationResult.valid ? <CheckCircle size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
          <div>
            <span className="font-medium">{validationResult.valid ? 'Valid' : `${validationResult.errors.length} error${validationResult.errors.length !== 1 ? 's' : ''}`}</span>
            {validationResult.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {validationResult.errors.map((e, i) => (
                  <li key={i}>{e.field ? <span className="font-mono">{e.field}:</span> : null} {e.message}</li>
                ))}
              </ul>
            )}
            {validationResult.warnings.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-amber-700">
                {validationResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

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

      {/* Relationships — incoming + outgoing edges from the doc graph.
          Available for any document (not just relationship docs). */}
      <CollapsibleSection title="Relationships" defaultOpen={false}>
        <RelationshipsPanel documentId={doc.document_id} namespace={doc.namespace} />
      </CollapsibleSection>

      {/* Traversal — BFS expansion through the relationship graph */}
      <CollapsibleSection title="Traversal" defaultOpen={false}>
        <TraversalPanel documentId={doc.document_id} namespace={doc.namespace} />
      </CollapsibleSection>

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
                  v.version === doc.version && 'bg-primary/5/50'
                )}
              >
                <Layers size={14} className="text-gray-300" />
                <span className="text-sm font-medium text-gray-700">Version {v.version}</span>
                {v.version === doc.version && (
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">current</span>
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
