import type { FieldDefinition } from '@wip/client'
import { TextInput, NumberInput, SelectInput, Toggle } from '@/components/common/FormInputs'
import DateTimeInput from './DateTimeInput'
import TermFieldInput from './TermFieldInput'
import ReferenceFieldInput from './ReferenceFieldInput'
import FileFieldInput from './FileFieldInput'
import ArrayFieldInput from './ArrayFieldInput'
import ObjectFieldInput from './ObjectFieldInput'
import NestedObjectInput from './NestedObjectInput'

// ---------------------------------------------------------------------------
// FieldInput — dispatcher that renders the right widget per field.type.
//
// Every template field type has a widget: scalars (string — a select when the
// field declares an enum — number/integer, boolean, date, datetime), plus
// term, reference, file, array and object (a sub-form when the object is
// shaped by a template, else JSON). A type this console doesn't know
// renders a "not supported" notice instead of crashing the form.
// ---------------------------------------------------------------------------

export interface FieldInputProps {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  error?: string
  /** The document's namespace. File widgets upload into it (CASE-249); term and
   *  reference widgets resolve bare terminology/template values in it. Optional
   *  for standalone callers. */
  namespace?: string
  /** Document references may point only into `namespace` itself (edge endpoints). */
  ownNamespaceOnly?: boolean
  /** id for the input control, so a <label htmlFor> names it (plain text, number, choice, term and reference fields). */
  id?: string
}

/**
 * The input widget for one template field, chosen by `field.type`, with its error message underneath.
 */
export default function FieldInput({ field, value, onChange, disabled, error, namespace, ownNamespaceOnly, id }: FieldInputProps) {
  const control = renderControl({ field, value, onChange, disabled, namespace, ownNamespaceOnly, id })
  return (
    <div>
      {control}
      {error && <div className="text-xs text-danger mt-1">{error}</div>}
    </div>
  )
}

function renderControl({ field, value, onChange, disabled, namespace, ownNamespaceOnly, id }: FieldInputProps) {
  const enumValues = field.validation?.enum as (string | number)[] | undefined

  switch (field.type) {
    case 'string': {
      const str = value == null ? '' : String(value)
      if (enumValues && enumValues.length > 0) {
        return (
          <SelectInput<string>
          id={id}
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
          id={id}
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
          id={id}
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
        <TermFieldInput id={id} field={field} value={value} onChange={onChange} disabled={disabled} namespace={namespace} />
      )
    case 'reference':
      return (
        <ReferenceFieldInput id={id} field={field} value={value} onChange={onChange} disabled={disabled} namespace={namespace} ownNamespaceOnly={ownNamespaceOnly} />
      )
    case 'file':
      return (
        <FileFieldInput field={field} value={value} onChange={onChange} disabled={disabled} namespace={namespace} />
      )
    case 'array':
      return (
        <ArrayFieldInput field={field} value={value} onChange={onChange} disabled={disabled} namespace={namespace} id={id} />
      )
    case 'object':
      // An object shaped by a template gets a sub-form; an emptied one is
      // cleared rather than sent as {} (its nested mandatory fields would fail).
      if (field.template_ref) {
        return (
          <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50/50">
            <NestedObjectInput
              templateRef={field.template_ref}
              templateVersion={field.template_ref_version}
              value={value}
              onChange={(v) => onChange(Object.keys(v).length > 0 ? v : null)}
              disabled={disabled}
              namespace={namespace}
              idPrefix={id ?? `nested-${field.name}`}
              groupLabel={field.label || field.name}
            />
          </div>
        )
      }
      return (
        <ObjectFieldInput value={value} onChange={onChange} disabled={disabled} />
      )
    default:
      return (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
          Field type <span className="font-mono">{field.type}</span> not supported.
        </div>
      )
  }
}
