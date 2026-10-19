import { useQuery } from '@tanstack/react-query'
import { useWipClient } from '@wip/react'
import { Label } from '@/components/common/FormInputs'
import FieldInput from './FieldInput'
import ObjectFieldInput from './ObjectFieldInput'

// ---------------------------------------------------------------------------
// NestedObjectInput — a sub-form for an object whose shape is another
// template: an `object` field with `template_ref`, or one item of an array
// with `array_template_ref`. Each of the nested template's fields renders
// through FieldInput, so nesting recurses.
//
// The nested template is loaded at the version the field pins
// (`template_ref_version` / `array_template_ref_version`; the platform
// requires the pin on array items), else its latest. If it cannot be loaded,
// the object falls back to the JSON editor.
//
// The value is the object itself. A field cleared in the sub-form is removed
// from the object; the editor's merge patch then deletes it on save.
// ---------------------------------------------------------------------------

export interface NestedObjectInputProps {
  templateRef: string
  templateVersion?: number
  value: unknown
  onChange: (v: Record<string, unknown>) => void
  disabled?: boolean
  namespace?: string
  /** Prefix for the nested inputs' ids, so each nested label names its input. */
  idPrefix: string
  /** Names the sub-form as a group (an object field's label). */
  groupLabel?: string
}

/** Sub-form over a nested template's fields (see header above). */
export default function NestedObjectInput({
  templateRef,
  templateVersion,
  value,
  onChange,
  disabled,
  namespace,
  idPrefix,
  groupLabel,
}: NestedObjectInputProps) {
  const client = useWipClient()
  const templateQ = useQuery({
    queryKey: ['rc-console', 'template-pinned', templateRef, templateVersion],
    queryFn: () => client.templates.getTemplate(templateRef, templateVersion),
    retry: false,
    staleTime: 60_000,
  })
  const obj = isPlainObject(value) ? value : {}

  if (templateQ.isLoading) {
    return <p className="text-xs text-gray-400">Loading nested fields...</p>
  }
  if (!templateQ.data) {
    return (
      <div>
        <p className="text-[11px] text-amber-600 mb-1">
          Nested template <span className="font-mono">{templateRef}</span>
          {templateVersion !== undefined && <> v{templateVersion}</>} could not be loaded
          {templateQ.error ? `: ${templateQ.error.message}` : ''}. Edit it as JSON.
        </p>
        <ObjectFieldInput value={value} onChange={(v) => onChange(isPlainObject(v) ? v : {})} disabled={disabled} />
      </div>
    )
  }

  const update = (name: string, v: unknown) => {
    const next = { ...obj }
    if (v === null || v === undefined) delete next[name]
    else next[name] = v
    onChange(next)
  }

  return (
    <div role={groupLabel ? 'group' : undefined} aria-label={groupLabel} className="space-y-2.5">
      {(templateQ.data.fields ?? []).map((f) => {
        const id = `${idPrefix}-${f.name}`
        return (
          <div key={f.name}>
            <Label htmlFor={id}>
              {f.label || f.name}
              {f.mandatory && <span className="text-danger/60 ml-0.5">*</span>}
            </Label>
            <FieldInput
              id={id}
              field={f}
              value={obj[f.name]}
              onChange={(v) => update(f.name, v)}
              disabled={disabled}
              namespace={namespace}
            />
          </div>
        )
      })}
    </div>
  )
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
