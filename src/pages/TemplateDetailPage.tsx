import { useParams, Link } from 'react-router-dom'
import {
  FileCode2,
  ArrowLeft,
  Hash,
  Layers,
  Key,
  Tag,
  FileText,
  Link2,
} from 'lucide-react'
import { useTemplate } from '@wip/react'
import type { FieldDefinition } from '@wip/client'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Field Type Badge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    string: 'bg-green-100 text-green-700',
    number: 'bg-blue-100 text-blue-700',
    integer: 'bg-blue-100 text-blue-700',
    boolean: 'bg-yellow-100 text-yellow-700',
    date: 'bg-purple-100 text-purple-700',
    datetime: 'bg-purple-100 text-purple-700',
    term: 'bg-orange-100 text-orange-700',
    reference: 'bg-pink-100 text-pink-700',
    file: 'bg-gray-100 text-gray-700',
    array: 'bg-teal-100 text-teal-700',
    group: 'bg-indigo-100 text-indigo-700',
  }

  return (
    <span className={cn(
      'inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium',
      colors[type] ?? 'bg-gray-100 text-gray-500'
    )}>
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Field Row
// ---------------------------------------------------------------------------

function FieldRow({ field, isIdentity }: { field: FieldDefinition; isIdentity: boolean }) {
  const name = field.name
  const type = field.type ?? 'unknown'
  const label = field.label || null
  const mandatory = field.mandatory
  const terminologyRef = field.terminology_ref
  const referenceRef = field.template_ref

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5',
      isIdentity && 'bg-amber-50/50'
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-gray-800">{name}</span>
          {isIdentity && <Key size={12} className="text-amber-500" aria-label="Identity field" />}
          {mandatory && <span className="text-red-400 text-xs">*</span>}
        </div>
        {label && label !== name && (
          <p className="text-xs text-gray-400 mt-0.5">{label}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <TypeBadge type={type} />
        {terminologyRef && (
          <span className="flex items-center gap-1 text-xs text-orange-500">
            <Tag size={10} />
            {terminologyRef}
          </span>
        )}
        {referenceRef && (
          <span className="flex items-center gap-1 text-xs text-pink-500">
            <Link2 size={10} />
            {referenceRef}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Template Detail Page
// ---------------------------------------------------------------------------

export default function TemplateDetailPage() {
  const { id } = useParams()
  const { data: template, isLoading, error } = useTemplate(id ?? '')

  if (isLoading) return <LoadingState label="Loading template..." />
  if (error) return <ErrorState message={error.message} />
  if (!template) return <ErrorState message="Template not found" />

  const fields = template.fields ?? []
  const identityFields = new Set(
    Array.isArray(template.identity_fields) ? template.identity_fields.map(String) : []
  )

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <Link to="/templates" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 mb-2">
          <ArrowLeft size={12} />
          Back to Templates
        </Link>
        <div className="flex items-center gap-3">
          <FileCode2 size={24} className="text-indigo-500" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">{template.label || template.value}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-mono text-gray-400">{template.value}</span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Layers size={10} /> v{template.version ?? 1}
              </span>
              {template.namespace && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {template.namespace}
                </span>
              )}
              <StatusBadge status={template.status === 'active' ? 'active' : 'inactive'} label={template.status} />
            </div>
          </div>
        </div>
        {template.description && (
          <p className="text-sm text-gray-500 mt-2">{template.description}</p>
        )}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-6 text-xs text-gray-400">
        <span className="flex items-center gap-1"><Hash size={10} /> ID: {template.template_id}</span>
        <span>{fields.length} fields</span>
        {identityFields.size > 0 && (
          <span className="flex items-center gap-1">
            <Key size={10} className="text-amber-500" />
            Identity: {Array.from(identityFields).join(', ')}
          </span>
        )}
        {template.created_at && <span>Created: {new Date(template.created_at).toLocaleDateString()}</span>}
      </div>

      {/* Fields */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Fields</h2>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 p-6 text-center">No fields defined.</p>
          ) : (
            fields.map((field) => (
              <FieldRow
                key={String(field.name)}
                field={field}
                isIdentity={identityFields.has(String(field.name))}
              />
            ))
          )}
        </div>
      </div>

      {/* Quick link to documents */}
      <Link
        to={`/documents?template=${template.value}${template.namespace ? `&ns=${template.namespace}` : ''}`}
        className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700"
      >
        <FileText size={14} />
        View documents using this template
      </Link>
    </div>
  )
}
