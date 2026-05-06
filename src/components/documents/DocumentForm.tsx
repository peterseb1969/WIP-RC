import type { Template, FieldDefinition } from '@wip/client'
import { Label, Section } from '@/components/common/FormInputs'
import JsonViewer from '@/components/common/JsonViewer'
import FieldInput from './FieldInput'

// ---------------------------------------------------------------------------
// DocumentForm — body of the document editor.
//
// Renders one FieldInput per template field, wrapped in labels + inline error
// messages. Sections mirror the Template Editor (Data / Metadata / Raw JSON
// preview). Shell-level controls (header, save buttons, top banner) live in
// DocumentFormPage.
// ---------------------------------------------------------------------------

export interface DocumentFormProps {
  template: Template
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
  errors: Record<string, string>
  identityFieldNames: Set<string>
  mode: 'create' | 'edit'
}

export default function DocumentForm({
  template,
  value,
  onChange,
  errors,
  identityFieldNames,
  mode,
}: DocumentFormProps) {
  const fields = template.fields ?? []
  const isEdgeType = template.usage === 'relationship'

  // For edge types, surface source_ref / target_ref together at the top in a
  // dedicated "Endpoints" section. Other fields render in the regular Data
  // section beneath. Identity behaviour is unchanged — endpoints are
  // mandatory but not necessarily identity-fields.
  const endpointFields = isEdgeType
    ? fields.filter(f => f.name === 'source_ref' || f.name === 'target_ref')
    : []
  const dataFields = isEdgeType
    ? fields.filter(f => f.name !== 'source_ref' && f.name !== 'target_ref')
    : fields

  const updateField = (name: string, v: unknown) => {
    const next = { ...value }
    if (v === null || v === undefined || v === '') {
      delete next[name]
    } else {
      next[name] = v
    }
    onChange(next)
  }

  return (
    <div className="space-y-4">
      {isEdgeType && endpointFields.length > 0 && (
        <Section title="Endpoints" defaultOpen>
          <p className="text-[11px] text-gray-500 mb-2">
            Source and target documents this relationship connects. Both must live in the same namespace and be active or inactive (not archived).
          </p>
          {/* Render source_ref first, then target_ref, regardless of array order */}
          {['source_ref', 'target_ref'].flatMap(name => {
            const f = endpointFields.find(x => x.name === name)
            return f ? [
              <FieldRow
                key={f.name}
                field={f}
                value={value[f.name]}
                onChange={(v) => updateField(f.name, v)}
                error={errors[f.name]}
                disabled={mode === 'edit' && identityFieldNames.has(f.name)}
                namespace={template.namespace}
              />,
            ] : []
          })}
        </Section>
      )}

      <Section
        title={
          isEdgeType
            ? `Edge properties (${dataFields.length} field${dataFields.length === 1 ? '' : 's'})`
            : `Data (${fields.length} field${fields.length === 1 ? '' : 's'})`
        }
        defaultOpen
      >
        {dataFields.length === 0 && (
          <p className="text-sm text-gray-400">
            {isEdgeType ? 'This edge type has no extra properties — endpoints only.' : 'This template has no fields.'}
          </p>
        )}
        {dataFields.map((f) => (
          <FieldRow
            key={f.name}
            field={f}
            value={value[f.name]}
            onChange={(v) => updateField(f.name, v)}
            error={errors[f.name]}
            disabled={mode === 'edit' && identityFieldNames.has(f.name)}
            namespace={template.namespace}
          />
        ))}
      </Section>

      <Section title="Raw JSON preview">
        <JsonViewer data={value} maxHeight="260px" />
      </Section>
    </div>
  )
}

function FieldRow({
  field,
  value,
  onChange,
  error,
  disabled,
  namespace,
}: {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  error?: string
  disabled?: boolean
  namespace?: string
}) {
  const id = `df-${field.name}`
  return (
    <div>
      <Label htmlFor={id}>
        {field.label || field.name}
        {field.mandatory && <span className="text-red-400 ml-0.5">*</span>}
        {disabled && (
          <span
            className="ml-2 text-[10px] text-gray-400 font-normal"
            title="Identity field — cannot be changed via patch. Create a new document instead."
          >
            (identity — read only)
          </span>
        )}
      </Label>
      <FieldInput
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
        error={error}
        namespace={namespace}
      />
    </div>
  )
}
