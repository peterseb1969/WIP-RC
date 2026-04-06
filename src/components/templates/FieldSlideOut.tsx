import { useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import type { FieldDefinition, FieldType, FieldValidation, FileFieldConfig, SemanticType, ReferenceType, VersionStrategy } from '@wip/client'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_TYPES: FieldType[] = [
  'string', 'number', 'integer', 'boolean',
  'date', 'datetime', 'term', 'reference',
  'file', 'array', 'object',
]

const SEMANTIC_TYPES: SemanticType[] = [
  'email', 'url', 'latitude', 'longitude',
  'percentage', 'duration', 'geo_point',
]

const REFERENCE_TYPES: ReferenceType[] = ['document', 'term', 'terminology', 'template']

const VERSION_STRATEGIES: VersionStrategy[] = ['latest', 'pinned']

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-600 mb-1">{children}</label>
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  mono,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400',
        mono && 'font-mono'
      )}
    />
  )
}

function NumberInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
}) {
  return (
    <input
      id={id}
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
    />
  )
}

function SelectInput<T extends string>({
  id,
  value,
  options,
  onChange,
  placeholder,
  allowEmpty,
}: {
  id?: string
  value: T | undefined
  options: readonly T[]
  onChange: (v: T | undefined) => void
  placeholder?: string
  allowEmpty?: boolean
}) {
  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
    >
      {(allowEmpty !== false) && <option value="">{placeholder ?? '(none)'}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id?: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 w-full text-left mb-2"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reference picker (terminology or template)
// ---------------------------------------------------------------------------

function ReferencePicker({
  label: fieldLabel,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | undefined
  options: Array<{ id: string; label: string; value: string }>
  onChange: (id: string | undefined) => void
}) {
  return (
    <div>
      <Label>{fieldLabel}</Label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
      >
        <option value="">(none)</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.label} ({o.value})</option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Validation section
// ---------------------------------------------------------------------------

function ValidationSection({
  validation,
  fieldType,
  onChange,
}: {
  validation: FieldValidation | undefined
  fieldType: FieldType
  onChange: (v: FieldValidation | undefined) => void
}) {
  const val = validation ?? {}
  const update = (patch: Partial<FieldValidation>) => {
    const next = { ...val, ...patch }
    // Clean up undefined values
    const clean = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== undefined && v !== '' && v !== null)
    ) as FieldValidation
    onChange(Object.keys(clean).length > 0 ? clean : undefined)
  }

  const showString = fieldType === 'string'
  const showNumeric = fieldType === 'number' || fieldType === 'integer'
  const showEnum = fieldType === 'string' || fieldType === 'number' || fieldType === 'integer'

  if (!showString && !showNumeric && !showEnum) return null

  return (
    <>
      {showString && (
        <>
          <div>
            <Label htmlFor="val-pattern">Pattern (regex)</Label>
            <TextInput id="val-pattern" value={val.pattern ?? ''} onChange={(v) => update({ pattern: v || undefined })} placeholder="^[A-Z].*$" mono />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="val-minlen">Min length</Label>
              <NumberInput id="val-minlen" value={val.min_length} onChange={(v) => update({ min_length: v })} />
            </div>
            <div>
              <Label htmlFor="val-maxlen">Max length</Label>
              <NumberInput id="val-maxlen" value={val.max_length} onChange={(v) => update({ max_length: v })} />
            </div>
          </div>
        </>
      )}
      {showNumeric && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="val-min">Minimum</Label>
            <NumberInput id="val-min" value={val.minimum} onChange={(v) => update({ minimum: v })} />
          </div>
          <div>
            <Label htmlFor="val-max">Maximum</Label>
            <NumberInput id="val-max" value={val.maximum} onChange={(v) => update({ maximum: v })} />
          </div>
        </div>
      )}
      {showEnum && (
        <div>
          <Label htmlFor="val-enum">Allowed values (comma-separated)</Label>
          <TextInput
            id="val-enum"
            value={(val.enum ?? []).join(', ')}
            onChange={(v) => {
              const items = v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined
              update({ enum: items?.length ? items : undefined })
            }}
            placeholder="value1, value2, value3"
          />
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// File config section
// ---------------------------------------------------------------------------

function FileConfigSection({
  config,
  onChange,
}: {
  config: FileFieldConfig | undefined
  onChange: (c: FileFieldConfig | undefined) => void
}) {
  const fc = config ?? { allowed_types: [], max_size_mb: 10, multiple: false }
  const update = (patch: Partial<FileFieldConfig>) => onChange({ ...fc, ...patch })

  return (
    <>
      <div>
        <Label htmlFor="fc-types">Allowed MIME types (comma-separated)</Label>
        <TextInput
          id="fc-types"
          value={fc.allowed_types.join(', ')}
          onChange={(v) => update({ allowed_types: v.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="application/pdf, image/png"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="fc-maxsize">Max size (MB)</Label>
          <NumberInput id="fc-maxsize" value={fc.max_size_mb} onChange={(v) => update({ max_size_mb: v ?? 10 })} />
        </div>
        <div>
          <Label htmlFor="fc-maxfiles">Max files</Label>
          <NumberInput id="fc-maxfiles" value={fc.max_files} onChange={(v) => update({ max_files: v })} />
        </div>
      </div>
      <Toggle id="fc-multi" checked={fc.multiple} onChange={(v) => update({ multiple: v })} label="Allow multiple files" />
    </>
  )
}

// ---------------------------------------------------------------------------
// FieldSlideOut
// ---------------------------------------------------------------------------

export interface FieldSlideOutProps {
  field: FieldDefinition
  onChange: (field: FieldDefinition) => void
  onClose: () => void
  terminologies: Array<{ id: string; label: string; value: string }>
  templates: Array<{ id: string; label: string; value: string }>
}

export default function FieldSlideOut({
  field,
  onChange,
  onClose,
  terminologies,
  templates,
}: FieldSlideOutProps) {
  const update = (patch: Partial<FieldDefinition>) => onChange({ ...field, ...patch })

  const isTermType = field.type === 'term'
  const isRefType = field.type === 'reference'
  const isFileType = field.type === 'file'
  const isArrayType = field.type === 'array'
  const showReferences = isTermType || isRefType
  const showFileConfig = isFileType || (isArrayType && field.array_item_type === 'file')

  // When type changes, clear type-specific fields
  const handleTypeChange = (newType: FieldType | undefined) => {
    if (!newType) return
    const cleaned: Partial<FieldDefinition> = { type: newType }
    // Clear irrelevant fields when switching types
    if (newType !== 'term' && newType !== 'reference') {
      cleaned.terminology_ref = undefined
      cleaned.template_ref = undefined
      cleaned.reference_type = undefined
      cleaned.target_templates = undefined
      cleaned.target_terminologies = undefined
      cleaned.version_strategy = undefined
      cleaned.include_subtypes = undefined
    }
    if (newType !== 'file') {
      cleaned.file_config = undefined
    }
    if (newType !== 'array') {
      cleaned.array_item_type = undefined
      cleaned.array_terminology_ref = undefined
      cleaned.array_template_ref = undefined
      cleaned.array_file_config = undefined
    }
    if (newType !== 'string') {
      // Clear string-specific validation
      if (field.validation?.pattern || field.validation?.min_length || field.validation?.max_length) {
        cleaned.validation = undefined
      }
    }
    onChange({ ...field, ...cleaned })
  }

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/50">
        <h3 className="text-sm font-semibold text-gray-700">
          {field.name || 'New Field'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Inherited field warning */}
        {field.inherited && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            This field is inherited from <span className="font-mono">{field.inherited_from ?? 'parent'}</span>.
            Edit the parent template to modify it.
          </div>
        )}

        {/* === Default visible fields === */}

        {/* Name */}
        <div>
          <Label htmlFor="field-name">Name</Label>
          <TextInput
            id="field-name"
            value={field.name}
            onChange={(v) => update({ name: v })}
            placeholder="field_name"
            mono
          />
        </div>

        {/* Label */}
        <div>
          <Label htmlFor="field-label">Label</Label>
          <TextInput
            id="field-label"
            value={field.label}
            onChange={(v) => update({ label: v })}
            placeholder="Human-readable label"
          />
        </div>

        {/* Type */}
        <div>
          <Label htmlFor="field-type">Type</Label>
          <SelectInput
            id="field-type"
            value={field.type}
            options={FIELD_TYPES}
            onChange={handleTypeChange}
            allowEmpty={false}
          />
        </div>

        {/* Mandatory */}
        <Toggle
          id="field-mandatory"
          checked={field.mandatory}
          onChange={(v) => update({ mandatory: v })}
          label="Required field"
        />

        {/* Default value */}
        <div>
          <Label htmlFor="field-default">Default value</Label>
          <TextInput
            id="field-default"
            value={field.default_value !== undefined ? String(field.default_value) : ''}
            onChange={(v) => update({ default_value: v || undefined })}
            placeholder="(none)"
          />
        </div>

        {/* === References section (term / reference types only) === */}
        {showReferences && (
          <Section title="References" defaultOpen>
            {isTermType && (
              <>
                <ReferencePicker
                  label="Terminology"
                  value={field.terminology_ref}
                  options={terminologies}
                  onChange={(id) => update({ terminology_ref: id })}
                />
                <Toggle
                  id="field-subtypes"
                  checked={field.include_subtypes ?? false}
                  onChange={(v) => update({ include_subtypes: v || undefined })}
                  label="Include subtypes"
                />
              </>
            )}
            {isRefType && (
              <>
                <div>
                  <Label htmlFor="field-reftype">Reference type</Label>
                  <SelectInput
                    id="field-reftype"
                    value={field.reference_type}
                    options={REFERENCE_TYPES}
                    onChange={(v) => update({ reference_type: v })}
                    placeholder="Select reference type..."
                  />
                </div>
                <ReferencePicker
                  label="Template ref"
                  value={field.template_ref}
                  options={templates}
                  onChange={(id) => update({ template_ref: id })}
                />
                <div>
                  <Label htmlFor="field-verstrat">Version strategy</Label>
                  <SelectInput
                    id="field-verstrat"
                    value={field.version_strategy}
                    options={VERSION_STRATEGIES}
                    onChange={(v) => update({ version_strategy: v })}
                    placeholder="(default)"
                  />
                </div>
              </>
            )}
          </Section>
        )}

        {/* === File config section (file type) === */}
        {showFileConfig && (
          <Section title="File Configuration" defaultOpen>
            <FileConfigSection
              config={isFileType ? field.file_config : field.array_file_config}
              onChange={(c) => update(isFileType ? { file_config: c } : { array_file_config: c })}
            />
          </Section>
        )}

        {/* === Array config section === */}
        {isArrayType && (
          <Section title="Array Configuration" defaultOpen>
            <div>
              <Label htmlFor="field-arraytype">Item type</Label>
              <SelectInput
                id="field-arraytype"
                value={field.array_item_type}
                options={FIELD_TYPES.filter(t => t !== 'array' && t !== 'object')}
                onChange={(v) => update({ array_item_type: v })}
                placeholder="Select item type..."
              />
            </div>
            {field.array_item_type === 'term' && (
              <ReferencePicker
                label="Array terminology ref"
                value={field.array_terminology_ref}
                options={terminologies}
                onChange={(id) => update({ array_terminology_ref: id })}
              />
            )}
            {field.array_item_type === 'reference' && (
              <ReferencePicker
                label="Array template ref"
                value={field.array_template_ref}
                options={templates}
                onChange={(id) => update({ array_template_ref: id })}
              />
            )}
          </Section>
        )}

        {/* === Advanced section (collapsed by default) === */}
        <Section title="Advanced">
          {/* Semantic type */}
          <div>
            <Label htmlFor="field-semantic">Semantic type</Label>
            <SelectInput
              id="field-semantic"
              value={field.semantic_type}
              options={SEMANTIC_TYPES}
              onChange={(v) => update({ semantic_type: v })}
              placeholder="(none)"
            />
          </div>

          {/* Validation */}
          <ValidationSection
            validation={field.validation}
            fieldType={field.type}
            onChange={(v) => update({ validation: v })}
          />
        </Section>
      </div>
    </div>
  )
}
