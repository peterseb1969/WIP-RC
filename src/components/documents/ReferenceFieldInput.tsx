import { Layers, FolderTree } from 'lucide-react'
import { useTemplates, useTerminologies } from '@wip/react'
import type { FieldDefinition, Template, Terminology } from '@wip/client'
import DocumentRefPicker from './DocumentRefPicker'
import RefCombobox, { type RefItem } from './RefCombobox'
import TermFieldInput from './TermFieldInput'

// ---------------------------------------------------------------------------
// ReferenceFieldInput — polymorphic reference picker.
//
// `field.reference_type` dispatches between four sub-pickers:
//   - 'document'    — DocumentRefPicker: every target template, server-side search
//   - 'term'        — the term field's picker over the first target terminology
//   - 'terminology' — searchable over useTerminologies
//   - 'template'    — searchable over useTemplates
//
// The form state stores the reference by its lookup_value (typically the
// entity's canonical `value` or ID string), which the server resolves to a
// full Reference{resolved,...} on save.
//
// The document, terminology and template pickers share RefCombobox.
// ---------------------------------------------------------------------------

export interface ReferenceFieldInputProps {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  /** The referring document's namespace: bare target values resolve in it, and it bounds which namespaces documents are offered from. */
  namespace?: string
  /** Offer documents from `namespace` only (edge endpoints must share the edge's namespace). */
  ownNamespaceOnly?: boolean
  /** id for the picker's trigger, so the field's <label htmlFor> names it. */
  id?: string
}

/**
 * Picker for a `reference` field — document, term, terminology or template by
 * `reference_type` — storing the chosen entity's lookup value (see header above).
 */
export default function ReferenceFieldInput(props: ReferenceFieldInputProps) {
  const { field } = props
  const refType = field.reference_type

  if (refType === 'document') return <DocumentRefPicker {...props} />
  if (refType === 'term') return <TermRefPicker {...props} />
  if (refType === 'terminology') return <TerminologyRefPicker {...props} />
  if (refType === 'template') return <TemplateRefPicker {...props} />

  return (
    <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
      No reference_type configured on this field.
    </div>
  )
}

// ---------------------------------------------------------------------------
// Term reference picker (reference_type='term')
// ---------------------------------------------------------------------------

// The term field's picker, over the field's first target terminology: it
// browses the first page of terms and searches the whole terminology.
function TermRefPicker({ field, value, onChange, disabled, namespace, id }: ReferenceFieldInputProps) {
  const targets = field.target_terminologies ?? []
  const first = targets[0]
  if (!first) {
    return (
      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
        No target terminology configured on this field.
      </div>
    )
  }
  return (
    <div>
      <TermFieldInput
        id={id}
        field={{ ...field, terminology_ref: first }}
        value={value}
        onChange={onChange}
        disabled={disabled}
        namespace={namespace}
      />
      {targets.length > 1 && (
        <p className="mt-1 text-[10px] text-amber-600">
          Offers terms from {first} only; this field also accepts {targets.slice(1).join(', ')}.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Terminology reference picker
// ---------------------------------------------------------------------------

function TerminologyRefPicker({ value, onChange, disabled, id }: ReferenceFieldInputProps) {
  const { data, isLoading } = useTerminologies({ page_size: 1000 })
  const items: RefItem[] = (data?.items ?? []).map((t: Terminology) => ({
    id: t.terminology_id,
    value: t.value,
    label: t.label || t.value,
    subLabel: t.value,
    icon: <FolderTree size={11} className="text-success/60 shrink-0" />,
  }))
  return (
    <RefCombobox
      id={id}
      items={items}
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      disabled={disabled}
      isLoading={isLoading}
      placeholder="Select a terminology..."
      emptyLabel="No terminologies match."
    />
  )
}

// ---------------------------------------------------------------------------
// Template reference picker
// ---------------------------------------------------------------------------

function TemplateRefPicker({ value, onChange, disabled, id }: ReferenceFieldInputProps) {
  const { data, isLoading } = useTemplates({ status: 'active', latest_only: true, page_size: 1000 })
  const items: RefItem[] = (data?.items ?? []).map((t: Template) => ({
    id: t.template_id,
    value: t.value,
    label: t.label || t.value,
    subLabel: t.value,
    icon: <Layers size={11} className="text-indigo-400 shrink-0" />,
  }))
  return (
    <RefCombobox
      id={id}
      items={items}
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      disabled={disabled}
      isLoading={isLoading}
      placeholder="Select a template..."
      emptyLabel="No templates match."
    />
  )
}
