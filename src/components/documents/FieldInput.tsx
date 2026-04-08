import type { FieldDefinition } from '@wip/client'
import { TextInput, NumberInput, SelectInput, Toggle } from '@/components/common/FormInputs'
import DateTimeInput from './DateTimeInput'
import TermFieldInput from './TermFieldInput'
import ReferenceFieldInput from './ReferenceFieldInput'

// ---------------------------------------------------------------------------
// FieldInput — dispatcher that renders the right widget per field.type.
//
// v1 focuses on scalar types. term/reference/file/array/object get wired up
// in later steps; until then they render a textarea fallback so the form
// still renders without crashing.
// ---------------------------------------------------------------------------

export interface FieldInputProps {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  error?: string
}

export default function FieldInput({ field, value, onChange, disabled, error }: FieldInputProps) {
  const control = renderControl({ field, value, onChange, disabled })
  return (
    <div>
      {control}
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </div>
  )
}

function renderControl({ field, value, onChange, disabled }: FieldInputProps) {
  const enumValues = field.validation?.enum as (string | number)[] | undefined

  switch (field.type) {
    case 'string': {
      const str = value == null ? '' : String(value)
      if (enumValues && enumValues.length > 0) {
        return (
          <SelectInput<string>
            value={str || undefined}
            options={enumValues.map(String)}
            onChange={(v) => onChange(v ?? null)}
            placeholder="(none)"
            disabled={disabled}
          />
        )
      }
      return (
        <TextInput
          value={str}
          onChange={(v) => onChange(v === '' ? null : v)}
          placeholder={field.label}
          disabled={disabled}
        />
      )
    }
    case 'number':
    case 'integer': {
      const num = typeof value === 'number' ? value : undefined
      return (
        <NumberInput
          value={num}
          onChange={(v) => onChange(v == null ? null : field.type === 'integer' ? Math.trunc(v) : v)}
          disabled={disabled}
        />
      )
    }
    case 'boolean': {
      const b = value === true
      return (
        <Toggle
          checked={b}
          onChange={(v) => onChange(v)}
          label={b ? 'Yes' : 'No'}
          disabled={disabled}
        />
      )
    }
    case 'date':
      return (
        <DateTimeInput
          mode="date"
          value={typeof value === 'string' ? value : undefined}
          onChange={(v) => onChange(v ?? null)}
          disabled={disabled}
        />
      )
    case 'datetime':
      return (
        <DateTimeInput
          mode="datetime"
          value={typeof value === 'string' ? value : undefined}
          onChange={(v) => onChange(v ?? null)}
          disabled={disabled}
        />
      )
    case 'term':
      return (
        <TermFieldInput field={field} value={value} onChange={onChange} disabled={disabled} />
      )
    case 'reference':
      return (
        <ReferenceFieldInput field={field} value={value} onChange={onChange} disabled={disabled} />
      )
    default:
      // term / reference / file / array / object — placeholder until wired up
      return (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
          Field type <span className="font-mono">{field.type}</span> not yet editable in v1.
        </div>
      )
  }
}
