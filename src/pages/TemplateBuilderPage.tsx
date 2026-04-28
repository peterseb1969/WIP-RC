import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import {
  useTemplate,
  useTemplates,
  useTerminologies,
  useNamespaces,
  useCreateTemplate,
  useUpdateTemplate,
  useActivateTemplate,
} from '@wip/react'
import type { FieldDefinition, ValidationRule, CreateTemplateRequest, UpdateTemplateRequest, TemplateMetadata } from '@wip/client'
import FieldList from '@/components/templates/FieldList'
import FieldSlideOut from '@/components/templates/FieldSlideOut'
import FieldQuickAdd from '@/components/templates/FieldQuickAdd'
import VersionWarnings from '@/components/templates/VersionWarnings'
import RuleList from '@/components/templates/RuleList'
import TemplateDiffView from '@/components/templates/TemplateDiffView'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import { Section } from '@/components/common/FormInputs'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// TemplateBuilderPage
// ---------------------------------------------------------------------------

export default function TemplateBuilderPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = !!id
  const cloneFromId = !isEdit ? (searchParams.get('from') ?? '') : ''
  const { namespace: globalNs } = useNamespaceFilter()

  // Load existing template for edit mode, or source template for clone mode
  const { data: existing, isLoading: loadingTemplate, error: loadError } = useTemplate(id || cloneFromId || '')

  // Reference data for pickers
  const { data: terminologiesData } = useTerminologies({ status: 'active', page_size: 1000 })
  const { data: templatesData } = useTemplates({ status: 'active', latest_only: true, page_size: 100 })
  const { data: namespacesData } = useNamespaces()

  // Terminology/template options for reference pickers
  const terminologyOptions = useMemo(
    () => (terminologiesData?.items ?? []).map(t => ({
      id: t.terminology_id,
      label: t.label || t.value,
      value: t.value,
    })),
    [terminologiesData],
  )
  const templateOptions = useMemo(
    () => (templatesData?.items ?? []).map(t => ({
      id: t.template_id,
      label: t.label || t.value,
      value: t.value,
    })),
    [templatesData],
  )

  // --- Form state ---
  const [initialized, setInitialized] = useState(false)
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [namespace, setNamespace] = useState(globalNs || '')
  const [extendsTemplate, setExtendsTemplate] = useState<string | undefined>()
  const [extendsVersion, setExtendsVersion] = useState<number | undefined>()
  const [identityFields, setIdentityFields] = useState<string[]>([])
  const [fields, setFields] = useState<FieldDefinition[]>([])
  const [rules, setRules] = useState<ValidationRule[]>([])

  // Metadata (advanced)
  const [domain, setDomain] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')

  // Reporting (advanced)
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [syncStrategy, setSyncStrategy] = useState('')
  const [tableName, setTableName] = useState('')
  const [includeMetadata, setIncludeMetadata] = useState(false)
  const [flattenArrays, setFlattenArrays] = useState(false)
  const [maxArrayElements, setMaxArrayElements] = useState<number | undefined>(undefined)

  // UI state
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveMode, setSaveMode] = useState<'draft' | 'active' | null>(null)
  const [hasBlockingWarning, setHasBlockingWarning] = useState(false)

  // Initialize form from existing template (edit mode or clone mode)
  if ((isEdit || cloneFromId) && existing && !initialized) {
    setValue(isEdit ? (existing.value ?? '') : '') // blank value for clones — user must choose
    setLabel(isEdit ? (existing.label ?? '') : `${existing.label ?? existing.value ?? ''} (copy)`)
    setDescription(existing.description ?? '')
    setNamespace(isEdit ? (existing.namespace ?? '') : (globalNs || (existing.namespace ?? '')))
    setExtendsTemplate(existing.extends ?? undefined)
    setExtendsVersion(existing.extends_version ?? undefined)
    setIdentityFields(existing.identity_fields ?? [])
    setFields(existing.fields ?? [])
    setRules(existing.rules ?? [])
    setDomain(existing.metadata?.domain ?? '')
    setCategory(existing.metadata?.category ?? '')
    setTags((existing.metadata?.tags ?? []).join(', '))
    setSyncEnabled(existing.reporting?.sync_enabled ?? false)
    setSyncStrategy(existing.reporting?.sync_strategy ?? '')
    setTableName(isEdit ? (existing.reporting?.table_name ?? '') : '') // blank table name for clones
    setIncludeMetadata(existing.reporting?.include_metadata ?? false)
    setFlattenArrays(existing.reporting?.flatten_arrays ?? false)
    setMaxArrayElements(existing.reporting?.max_array_elements ?? undefined)
    setInitialized(true)
  }
  // For create mode (no clone), mark initialized immediately
  if (!isEdit && !cloneFromId && !initialized) {
    setInitialized(true)
  }

  // --- Mutations ---
  const createTemplate = useCreateTemplate({
    onSuccess: (result) => {
      if (result.id) navigate(`/templates/${result.id}`)
    },
    onError: (err: Error) => setError(err.message),
  })

  const updateTemplate = useUpdateTemplate({
    onSuccess: (result) => {
      if (saveMode === 'active' && (result.id || id)) {
        activateTemplate.mutate({ id: (result.id || id)!, namespace })
      } else {
        navigate(`/templates/${id}`)
      }
    },
    onError: (err: Error) => setError(err.message),
  })

  const activateTemplate = useActivateTemplate({
    onSuccess: () => {
      navigate(`/templates/${id ?? ''}`)
    },
    onError: (err: Error) => setError(`Save succeeded but activation failed: ${err.message}`),
  })

  const isPending = createTemplate.isPending || updateTemplate.isPending || activateTemplate.isPending

  // --- Field operations ---
  const fieldNames = useMemo(() => new Set(fields.map(f => f.name)), [fields])

  const handleAddField = useCallback((field: FieldDefinition) => {
    setFields(prev => [...prev, field])
    setSelectedFieldIndex(fields.length) // select the newly added field
  }, [fields.length])

  const handleRemoveField = useCallback((index: number) => {
    setFields(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next
    })
    setIdentityFields(prev => {
      const removedName = fields[index]?.name
      return removedName ? prev.filter(n => n !== removedName) : prev
    })
    if (selectedFieldIndex === index) setSelectedFieldIndex(null)
    else if (selectedFieldIndex !== null && selectedFieldIndex > index) {
      setSelectedFieldIndex(selectedFieldIndex - 1)
    }
  }, [fields, selectedFieldIndex])

  const handleReorderField = useCallback((fromIndex: number, toIndex: number) => {
    setFields(prev => {
      const next = [...prev]
      const moved = next.splice(fromIndex, 1)[0]!
      next.splice(toIndex, 0, moved)
      return next
    })
    // Update selected index to follow the moved field
    if (selectedFieldIndex === fromIndex) {
      setSelectedFieldIndex(toIndex)
    } else if (selectedFieldIndex !== null) {
      let newSelected = selectedFieldIndex
      if (fromIndex < selectedFieldIndex && toIndex >= selectedFieldIndex) newSelected--
      else if (fromIndex > selectedFieldIndex && toIndex <= selectedFieldIndex) newSelected++
      setSelectedFieldIndex(newSelected)
    }
  }, [selectedFieldIndex])

  const handleFieldChange = useCallback((updated: FieldDefinition) => {
    if (selectedFieldIndex === null) return
    setFields(prev => prev.map((f, i) => i === selectedFieldIndex ? updated : f))
    // Update identity fields if the name changed
    const oldName = fields[selectedFieldIndex]?.name
    if (oldName && updated.name !== oldName) {
      setIdentityFields(prev => prev.map(n => n === oldName ? updated.name : n))
    }
  }, [selectedFieldIndex, fields])

  // --- Save ---
  const handleSave = (mode: 'draft' | 'active') => {
    setError(null)
    setSaveMode(mode)

    if (!value.trim()) { setError('Template value is required'); return }
    if (!namespace) { setError('Namespace is required'); return }

    const metadata: Partial<TemplateMetadata> = {}
    if (domain.trim()) metadata.domain = domain.trim()
    if (category.trim()) metadata.category = category.trim()
    const tagList = tags.split(',').map(s => s.trim()).filter(Boolean)
    if (tagList.length > 0) metadata.tags = tagList

    const reporting: Record<string, unknown> = {}
    if (syncEnabled) {
      reporting.sync_enabled = true
      if (syncStrategy.trim()) reporting.sync_strategy = syncStrategy.trim()
      if (tableName.trim()) reporting.table_name = tableName.trim()
      if (includeMetadata) reporting.include_metadata = true
      if (flattenArrays) reporting.flatten_arrays = true
      if (maxArrayElements != null) reporting.max_array_elements = maxArrayElements
    }

    if (isEdit && id) {
      const data: UpdateTemplateRequest = {
        label: label.trim() || value.trim(),
        description: description.trim() || undefined,
        extends: extendsTemplate,
        extends_version: extendsVersion,
        identity_fields: identityFields.length > 0 ? identityFields : undefined,
        fields: fields.length > 0 ? fields : undefined,
        rules: rules.length > 0 ? rules : undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        reporting: Object.keys(reporting).length > 0 ? reporting as UpdateTemplateRequest['reporting'] : undefined,
        updated_by: 'rc-console',
      }
      updateTemplate.mutate({ id, data })
    } else {
      const data: CreateTemplateRequest = {
        value: value.trim(),
        label: label.trim() || value.trim(),
        description: description.trim() || undefined,
        namespace,
        extends: extendsTemplate,
        extends_version: extendsVersion,
        identity_fields: identityFields.length > 0 ? identityFields : undefined,
        fields: fields.length > 0 ? fields : undefined,
        rules: rules.length > 0 ? rules : undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        reporting: Object.keys(reporting).length > 0 ? reporting as CreateTemplateRequest['reporting'] : undefined,
        created_by: 'rc-console',
        status: mode,
      }
      createTemplate.mutate(data)
    }
  }

  // --- Loading / error states ---
  if ((isEdit || cloneFromId) && loadingTemplate) return <LoadingState label="Loading template..." />
  if ((isEdit || cloneFromId) && loadError) return <ErrorState message={loadError.message} />
  if (isEdit && !existing && !loadingTemplate) return <ErrorState message="Template not found" />

  const selectedField = selectedFieldIndex !== null ? fields[selectedFieldIndex] : null

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left panel — form + field list */}
      <div className={cn(
        'flex-1 overflow-y-auto p-6 space-y-4',
        selectedField ? 'max-w-[40%]' : 'max-w-5xl',
      )}>
        {/* Header */}
        <div>
          <Link to="/templates" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 mb-2">
            <ArrowLeft size={12} />
            Back to Templates
          </Link>
          <h1 className="text-2xl font-semibold text-gray-800">
            {isEdit ? `Edit: ${existing?.label || existing?.value}` : 'Create Template'}
          </h1>
          {isEdit && existing && (
            <p className="text-xs text-gray-400 mt-1">
              Version {existing.version ?? 1} &middot; {existing.status}
            </p>
          )}
        </div>

        {/* Template Metadata */}
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Value *</label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                placeholder="TEMPLATE_VALUE"
                disabled={isEdit}
                className={cn(
                  'w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400',
                  isEdit && 'bg-gray-50 text-gray-400'
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Human-readable label"
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Namespace *</label>
              <select
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                disabled={isEdit}
                className={cn(
                  'w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400',
                  isEdit && 'bg-gray-50 text-gray-400'
                )}
              >
                <option value="">Select namespace...</option>
                {namespacesData?.map(n => (
                  <option key={n.prefix} value={n.prefix}>{n.prefix}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Extends (parent template)</label>
              <select
                value={extendsTemplate ?? ''}
                onChange={(e) => {
                  setExtendsTemplate(e.target.value || undefined)
                  if (!e.target.value) setExtendsVersion(undefined)
                }}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">(none)</option>
                {templateOptions.map(t => (
                  <option key={t.id} value={t.id}>{t.label} ({t.value})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Advanced: Metadata */}
        <Section title="Metadata (domain, category, tags)">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. finance, healthcare"
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. documents, entities"
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </Section>

        {/* Advanced: Reporting */}
        <Section title="Reporting Configuration">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
            />
            <span className="text-sm text-gray-700">Enable reporting sync</span>
          </label>
          {syncEnabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sync strategy</label>
                  <select
                    value={syncStrategy}
                    onChange={(e) => setSyncStrategy(e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">default</option>
                    <option value="full">full</option>
                    <option value="incremental">incremental</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Table name</label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="auto-generated if empty"
                    className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                />
                <span className="text-sm text-gray-700">Include document metadata in reporting table</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flattenArrays}
                    onChange={(e) => setFlattenArrays(e.target.checked)}
                    className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                  />
                  <span className="text-sm text-gray-700">Flatten arrays (multi-row representation)</span>
                </label>
                <p className="text-xs text-gray-400 ml-6">
                  When enabled, array fields produce one row per element. When disabled, arrays are stored as JSON columns.
                </p>
                {flattenArrays && (
                  <div className="ml-6">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Max array elements</label>
                    <input
                      type="number"
                      value={maxArrayElements ?? ''}
                      onChange={(e) => setMaxArrayElements(e.target.value === '' ? undefined : Number(e.target.value))}
                      placeholder="unlimited"
                      min={1}
                      className="w-32 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </Section>

        {/* Identity Fields */}
        {fields.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Identity Fields</h3>
            <p className="text-xs text-gray-400 mb-2">
              Select fields that together uniquely identify a document. Order matters for hash computation.
            </p>
            <div className="flex flex-wrap gap-2">
              {fields.filter(f => !f.inherited).map(f => {
                const isIdentity = identityFields.includes(f.name)
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => {
                      setIdentityFields(prev =>
                        isIdentity
                          ? prev.filter(n => n !== f.name)
                          : [...prev, f.name]
                      )
                    }}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors',
                      isIdentity
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300'
                    )}
                  >
                    {isIdentity && <CheckCircle size={10} />}
                    {f.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Fields */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Fields ({fields.length})
          </h2>
          <FieldList
            fields={fields}
            identityFields={identityFields}
            selectedIndex={selectedFieldIndex}
            onSelectField={setSelectedFieldIndex}
            onRemoveField={handleRemoveField}
            onReorder={handleReorderField}
          />
          <FieldQuickAdd
            onAdd={handleAddField}
            existingNames={fieldNames}
          />
        </div>

        {/* Validation Rules */}
        <RuleList
          rules={rules}
          fieldNames={fields.map(f => f.name)}
          onChange={setRules}
        />

        {/* Review Changes (edit mode only) */}
        {isEdit && existing && (
          <Section title="Review Changes" defaultOpen>
            <TemplateDiffView
              originalFields={existing.fields ?? []}
              currentFields={fields}
              originalIdentity={existing.identity_fields ?? []}
              currentIdentity={identityFields}
              originalRules={existing.rules ?? []}
              currentRules={rules}
            />
          </Section>
        )}

        {/* Version Warnings (edit mode only) */}
        {isEdit && existing && (
          <VersionWarnings
            original={existing}
            currentFields={fields}
            currentIdentityFields={identityFields}
            namespace={namespace}
            onBlockingChange={setHasBlockingWarning}
          />
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Namespace warning */}
        {!namespace && !isEdit && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <AlertTriangle size={14} />
            Select a namespace in the top bar before saving.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pb-6">
          <button
            onClick={() => handleSave('draft')}
            disabled={isPending || (!isEdit && !namespace)}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Save size={14} />
            {isPending && saveMode === 'draft' ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            onClick={() => handleSave('active')}
            disabled={isPending || hasBlockingWarning || (!isEdit && !namespace)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            title={!namespace && !isEdit ? 'Select a namespace first' : hasBlockingWarning ? 'Resolve blocking warnings before saving' : undefined}
          >
            <CheckCircle size={14} />
            {isPending && saveMode === 'active' ? 'Saving...' : 'Save'}
          </button>
          <Link
            to={isEdit ? `/templates/${id}` : '/templates'}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* Right panel — field slide-out */}
      {selectedField && (
        <div className="w-[60%] border-l border-gray-200 shrink-0">
          <FieldSlideOut
            field={selectedField}
            onChange={handleFieldChange}
            onClose={() => setSelectedFieldIndex(null)}
            terminologies={terminologyOptions}
            templates={templateOptions}
            syncEnabled={syncEnabled}
          />
        </div>
      )}
    </div>
  )
}
