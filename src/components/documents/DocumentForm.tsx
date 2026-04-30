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
      <Section title={`Data (${fields.length} field${fields.length === 1 ? '' : 's'})`} defaultOpen>
        {fields.length === 0 && (
          <p className="text-sm text-gray-400">This template has no fields.</p>
        )}
        {fields.map((f) => (
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
