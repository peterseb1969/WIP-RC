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
} from 'lucide-react'
import { useDocument, useDocumentVersions, useTemplateByValue, useTerms } from '@wip/react'
import type { FieldDefinition } from '@wip/client'
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

function TermFieldValue({ terminologyRef, value }: { terminologyRef: string; value: string }) {
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
        <div className="flex items-center gap-3">
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
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
        {doc.created_at && (
          <span className="flex items-center gap-1">
            <Calendar size={10} /> Created: {new Date(doc.created_at).toLocaleString()}
          </span>
        )}
        {doc.updated_at && doc.updated_at !== doc.created_at && (
          <span className="flex items-center gap-1">
            <Clock size={10} /> Updated: {new Date(doc.updated_at).toLocaleString()}
          </span>
        )}
        {doc.created_by && (
          <span className="flex items-center gap-1">
            <User size={10} /> {doc.created_by}
          </span>
        )}
      </div>

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
