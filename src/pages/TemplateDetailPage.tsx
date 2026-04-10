import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  FileCode2,
  ArrowLeft,
  Hash,
  Layers,
  Key,
  Tag,
  FileText,
  Link2,
  GitBranch,
  Shield,
  Database,
  Calendar,
  User,
  Pencil,
  Trash2,
  AlertTriangle,
  Copy,
} from 'lucide-react'
import { useTemplate, useTerminologies, useTemplates, useDeleteTemplate, useWipClient } from '@wip/react'
import { useQuery } from '@tanstack/react-query'
import type { FieldDefinition } from '@wip/client'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import JsonViewer from '@/components/common/JsonViewer'
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

function FieldRow({ field, isIdentity, terminologyMap, templateMap }: {
  field: FieldDefinition
  isIdentity: boolean
  terminologyMap: Map<string, { label: string; id: string }>
  templateMap: Map<string, { label: string; id: string }>
}) {
  const name = field.name
  const type = field.type ?? 'unknown'
  const label = field.label || null
  const mandatory = field.mandatory
  const terminologyRef = field.terminology_ref
  const referenceRef = field.template_ref

  // Collect detail chips for sub-properties
  const details: string[] = []
  if (field.default_value !== undefined) details.push(`default: ${JSON.stringify(field.default_value)}`)
  if (field.semantic_type) details.push(`semantic: ${field.semantic_type}`)
  if (field.reference_type) details.push(`ref: ${field.reference_type}`)
  if (field.version_strategy) details.push(`ver: ${field.version_strategy}`)
  if (field.include_subtypes) details.push('incl. subtypes')
  if (field.inherited) details.push(`inherited from ${field.inherited_from ?? '?'}`)
  if (field.array_item_type) details.push(`array<${field.array_item_type}>`)

  // Validation summary
  const val = field.validation
  const valParts: string[] = []
  if (val?.pattern) valParts.push(`pattern: ${val.pattern}`)
  if (val?.min_length != null) valParts.push(`min: ${val.min_length}`)
  if (val?.max_length != null) valParts.push(`max: ${val.max_length}`)
  if (val?.minimum != null) valParts.push(`>= ${val.minimum}`)
  if (val?.maximum != null) valParts.push(`<= ${val.maximum}`)
  if (val?.enum?.length) valParts.push(`enum: [${val.enum.join(', ')}]`)

  // File config summary
  const fc = field.file_config
  const fcParts: string[] = []
  if (fc?.allowed_types?.length) fcParts.push(fc.allowed_types.join(', '))
  if (fc?.max_size_mb) fcParts.push(`${fc.max_size_mb} MB max`)
  if (fc?.multiple) fcParts.push(`multi (${fc.max_files ?? '∞'})`)

  return (
    <div className={cn(
      'px-4 py-2.5',
      isIdentity && 'bg-amber-50/50'
    )}>
      <div className="flex items-center gap-3">
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
          {terminologyRef && (() => {
            const entry = terminologyMap.get(terminologyRef)
            return entry ? (
              <Link to={`/terminologies/${entry.id}`} className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700">
                <Tag size={10} />
                {entry.label}
              </Link>
            ) : (
              <span className="flex items-center gap-1 text-xs text-orange-500 font-mono">
                <Tag size={10} />
                {terminologyRef}
              </span>
            )
          })()}
          {referenceRef && (() => {
            const entry = templateMap.get(referenceRef)
            return entry ? (
              <Link to={`/templates/${entry.id}`} className="flex items-center gap-1 text-xs text-pink-500 hover:text-pink-700">
                <Link2 size={10} />
                {entry.label}
              </Link>
            ) : (
              <span className="flex items-center gap-1 text-xs text-pink-500 font-mono">
                <Link2 size={10} />
                {referenceRef}
              </span>
            )
          })()}
        </div>
      </div>
      {/* Sub-properties row */}
      {(details.length > 0 || valParts.length > 0 || fcParts.length > 0 || field.target_templates?.length || field.target_terminologies?.length) && (
        <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1 ml-0 text-[10px] text-gray-400">
          {details.map((d, i) => <span key={i}>{d}</span>)}
          {valParts.length > 0 && <span className="text-purple-400">validation: {valParts.join(', ')}</span>}
          {fcParts.length > 0 && <span className="text-gray-400">file: {fcParts.join(', ')}</span>}
          {field.target_templates?.length ? <span>targets: {field.target_templates.join(', ')}</span> : null}
          {field.target_terminologies?.length ? <span>terminologies: {field.target_terminologies.join(', ')}</span> : null}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Template Detail Page
// ---------------------------------------------------------------------------

export default function TemplateDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const client = useWipClient()
  const { data: template, isLoading, error } = useTemplate(id ?? '')
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)
  const deactivate = useDeleteTemplate({
    onSuccess: () => navigate('/templates'),
    onError: (err) => setDeactivateError(err.message),
  })

  // Fetch all versions of this template (by value code)
  const { data: versionsData } = useQuery({
    queryKey: ['rc-console', 'template-versions', template?.value],
    queryFn: () => client.templates.getTemplateVersions(template!.value),
    enabled: !!template?.value,
    staleTime: 60_000,
  })
  const versions = versionsData?.items ?? []

  // Build ID→{name,id} lookup maps for terminology and template refs (must be before early returns)
  const { data: terminologiesData } = useTerminologies({ status: 'active', page_size: 1000 })
  const { data: templatesData } = useTemplates({ status: 'active', latest_only: true, page_size: 100 })

  if (isLoading) return <LoadingState label="Loading template..." />
  if (error) return <ErrorState message={error.message} />
  if (!template) return <ErrorState message="Template not found" />

  const fields = template.fields ?? []
  const identityFields = new Set(
    Array.isArray(template.identity_fields) ? template.identity_fields.map(String) : []
  )

  // Maps: ID → { label, id } so we can resolve terminology_ref/template_ref (which are IDs) to display names and links
  const terminologyMap = new Map<string, { label: string; id: string }>(
    (terminologiesData?.items ?? []).map(t => [t.terminology_id, { label: t.label || t.value, id: t.terminology_id }])
  )
  const templateMap = new Map<string, { label: string; id: string }>(
    (templatesData?.items ?? []).map(t => [t.template_id, { label: t.label || t.value, id: t.template_id }])
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
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-800">{template.label || template.value}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-mono text-gray-400">{template.value}</span>
              {versions.length > 1 ? (
                <select
                  value={template.template_id}
                  onChange={e => navigate(`/templates/${e.target.value}`)}
                  className="text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400"
                  title="Switch version"
                >
                  {versions
                    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
                    .map(v => (
                      <option key={v.template_id} value={v.template_id}>
                        v{v.version ?? 1} — {v.status}
                      </option>
                    ))}
                </select>
              ) : (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Layers size={10} /> v{template.version ?? 1}
                </span>
              )}
              {template.namespace && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {template.namespace}
                </span>
              )}
              <StatusBadge status={template.status === 'active' ? 'active' : 'inactive'} label={template.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/templates/${template.template_id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-600 hover:bg-gray-50 hover:text-blue-600"
            >
              <Pencil size={12} />
              Edit
            </Link>
            <Link
              to={`/templates/new?from=${template.template_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-600 hover:bg-gray-50 hover:text-blue-600"
              title="Create a new template pre-filled from this one"
            >
              <Copy size={12} />
              Duplicate
            </Link>
            {template.status === 'active' && !confirmDeactivate && (
              <button
                onClick={() => setConfirmDeactivate(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-sm rounded-md text-red-500 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 size={12} />
                Deactivate
              </button>
            )}
          </div>
        </div>
        {confirmDeactivate && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <span className="text-red-700">
              Deactivate <strong>{template.label || template.value}</strong>? Documents using this template will remain but the template will no longer appear in active lists.
            </span>
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button
                onClick={() => { setConfirmDeactivate(false); setDeactivateError(null) }}
                className="px-3 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => deactivate.mutate({ id: template.template_id, force: true })}
                disabled={deactivate.isPending}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs disabled:opacity-50"
              >
                {deactivate.isPending ? 'Deactivating...' : 'Confirm Deactivate'}
              </button>
            </div>
          </div>
        )}
        {deactivateError && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle size={14} className="shrink-0" />
            {deactivateError}
          </div>
        )}
        {template.description && (
          <p className="text-sm text-gray-500 mt-2">{template.description}</p>
        )}
      </div>

      {/* Metadata */}
      <div className="flex items-center flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
        <span className="flex items-center gap-1"><Hash size={10} /> ID: {template.template_id}</span>
        <span>{fields.length} fields</span>
        {identityFields.size > 0 && (
          <span className="flex items-center gap-1">
            <Key size={10} className="text-amber-500" />
            Identity: {Array.from(identityFields).join(', ')}
          </span>
        )}
        {template.extends && (
          <span className="flex items-center gap-1">
            <GitBranch size={10} />
            Extends: {(() => {
              const parentId = template.extends!
              const entry = templateMap.get(parentId)
              return entry ? (
                <Link to={`/templates/${entry.id}`} className="text-indigo-500 hover:text-indigo-700">
                  {entry.label}
                </Link>
              ) : parentId
            })()}
            {template.extends_version != null && ` (v${template.extends_version})`}
          </span>
        )}
        {template.created_at && (
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            Created: {new Date(template.created_at).toLocaleDateString()}
          </span>
        )}
        {template.created_by && (
          <span className="flex items-center gap-1">
            <User size={10} />
            {template.created_by}
          </span>
        )}
        {template.updated_at && (
          <span>Updated: {new Date(template.updated_at!).toLocaleDateString()}</span>
        )}
        {template.updated_by && (
          <span>by {template.updated_by}</span>
        )}
      </div>

      {/* Template metadata (domain, category, tags) */}
      {(() => {
        const meta = template.metadata
        if (!meta) return null
        if (!meta.domain && !meta.category && !meta.tags?.length) return null
        return (
          <div className="flex items-center flex-wrap gap-3 text-xs">
            {meta.domain && (
              <span className="text-gray-500">Domain: <span className="text-gray-700">{meta.domain}</span></span>
            )}
            {meta.category && (
              <span className="text-gray-500">Category: <span className="text-gray-700">{meta.category}</span></span>
            )}
            {meta.tags && meta.tags.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Tags:</span>
                {meta.tags.map(tag => (
                  <span key={tag} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">{tag}</span>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Reporting config */}
      {(() => {
        const rpt = template.reporting
        if (!rpt || !rpt.sync_enabled) return null
        return (
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Database size={10} />
              Reporting: {rpt.sync_strategy ?? 'default'}
            </span>
            {rpt.table_name && <span>Table: <span className="font-mono">{rpt.table_name}</span></span>}
            {rpt.include_metadata && <span>+metadata</span>}
            {rpt.flatten_arrays && <span>flatten arrays{rpt.max_array_elements ? ` (max ${rpt.max_array_elements})` : ''}</span>}
          </div>
        )
      })()}

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
                terminologyMap={terminologyMap}
                templateMap={templateMap}
              />
            ))
          )}
        </div>
      </div>

      {/* Validation Rules */}
      {(() => {
        const rules = template.rules
        if (!rules?.length) return null
        return (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1"><Shield size={12} /> Validation Rules ({rules.length})</span>
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {rules.map((rule, i) => (
                <div key={i} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded',
                      'bg-gray-100 text-gray-600'
                    )}>{rule.type}</span>
                    {rule.target_field && <span className="text-sm font-mono text-gray-700">{rule.target_field}</span>}
                    {rule.target_fields?.length ? <span className="text-xs font-mono text-gray-500">{rule.target_fields.join(', ')}</span> : null}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                  )}
                  {rule.error_message && (
                    <p className="text-xs text-gray-400 mt-0.5">{rule.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Quick link to documents */}
      <Link
        to={`/documents?template=${template.value}${template.namespace ? `&ns=${template.namespace}` : ''}`}
        className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700"
      >
        <FileText size={14} />
        View documents using this template
      </Link>

      {/* Raw JSON */}
      <details className="group">
        <summary className="text-sm font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700">
          Raw JSON
        </summary>
        <div className="mt-2">
          <JsonViewer data={template} maxHeight="400px" collapsed />
        </div>
      </details>
    </div>
  )
}
