import { Plus, Trash2 } from 'lucide-react'
import type { FieldDefinition, FieldType } from '@wip/client'
import FieldInput from './FieldInput'

// ---------------------------------------------------------------------------
// ArrayFieldInput — edits an array of items whose type comes from
// field.array_item_type. Renders FieldInput recursively for each item,
// using a synthetic "child field" with the array config lifted onto it.
//
// Add / remove buttons bracket each row. No drag-reorder in v1.
// ---------------------------------------------------------------------------

export interface ArrayFieldInputProps {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  /** Forwarded to file-typed array items so uploads carry the document's namespace (CASE-249). */
  namespace?: string
}

export default function ArrayFieldInput({ field, value, onChange, disabled, namespace }: ArrayFieldInputProps) {
  const items = Array.isArray(value) ? value : []
  const itemType = field.array_item_type

  // WIP allows array fields whose items are themselves nested template
  // objects (via array_template_ref). The form editor doesn't support
  // nested-template arrays in v1 — they'd require rendering a sub-form per
  // item. Surface a friendly read-only notice instead of the raw config gap.
  if (!itemType && field.array_template_ref) {
    return (
      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5">
        Nested object arrays aren&apos;t editable in the form view yet. Edit this field
        via the API or a JSON tool. ({items.length} item{items.length === 1 ? '' : 's'})
      </div>
    )
  }

  if (!itemType) {
    return (
      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
        No array_item_type configured on this field.
      </div>
    )
  }

  // Build a synthetic FieldDefinition that represents one array item. The
  // child FieldInput uses this to render the right widget.
  const itemField: FieldDefinition = {
    name: `${field.name}[]`,
    label: `${field.label || field.name} item`,
    type: itemType as FieldType,
    mandatory: false,
    terminology_ref: field.array_terminology_ref,
    template_ref: field.array_template_ref,
    reference_type: field.reference_type,
    target_templates: field.target_templates,
    target_terminologies: field.target_terminologies,
    file_config: field.array_file_config,
    metadata: {},
  }

  const updateItem = (i: number, v: unknown) => {
    const next = [...items]
    if (v === null || v === undefined || v === '') {
      next.splice(i, 1)
    } else {
      next[i] = v
    }
    onChange(next.length > 0 ? next : null)
  }

  const removeItem = (i: number) => {
    const next = items.filter((_, idx) => idx !== i)
    onChange(next.length > 0 ? next : null)
  }

  const addItem = () => {
    const blank = itemType === 'boolean' ? false : ''
    onChange([...items, blank])
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic">No items yet.</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <FieldInput
              field={itemField}
              value={item}
              onChange={(v) => updateItem(i, v)}
              disabled={disabled}
              namespace={namespace}
            />
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="shrink-0 mt-1 p-1 text-gray-300 hover:text-red-500"
              title="Remove item"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
        >
          <Plus size={12} /> Add item
        </button>
      )}
    </div>
  )
}
