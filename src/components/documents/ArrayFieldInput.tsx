import { useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { FieldDefinition, FieldType } from '@wip/client'
import FieldInput from './FieldInput'
import NestedObjectInput from './NestedObjectInput'

// ---------------------------------------------------------------------------
// ArrayFieldInput — edits an array of items whose type comes from
// field.array_item_type. Renders FieldInput recursively for each item,
// using a synthetic "child field" with the array config lifted onto it.
//
// Items shaped by a template (`array_template_ref`, item type `object` or
// unset) each get a sub-form (NestedObjectInput) at the pinned template
// version, in a card with its own remove button.
//
// Each item keeps a stable React key across removals, so an item's widget
// state (a JSON editor's text, an open picker) stays with that item. No
// drag-reorder in v1.
// ---------------------------------------------------------------------------

export interface ArrayFieldInputProps {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  /** Forwarded to the items: file uploads, term and reference pickers use the document's namespace. */
  namespace?: string
  /** The field's input id; nested items derive their input ids from it. */
  id?: string
}

/** Editable list for an array field; each item rendered by FieldInput as the array's item type. */
export default function ArrayFieldInput({ field, value, onChange, disabled, namespace, id }: ArrayFieldInputProps) {
  const items = Array.isArray(value) ? value : []
  const itemType = field.array_item_type
  const nestedTemplate = field.array_template_ref && (!itemType || itemType === 'object') ? field.array_template_ref : undefined
  const keys = useStableKeys(items.length)
  const base = id ?? `array-${field.name}`

  if (!itemType && !nestedTemplate) {
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
    type: (itemType ?? 'object') as FieldType,
    mandatory: false,
    terminology_ref: field.array_terminology_ref,
    template_ref: field.array_template_ref,
    template_ref_version: field.array_template_ref_version,
    reference_type: field.reference_type,
    target_templates: field.target_templates,
    target_terminologies: field.target_terminologies,
    file_config: field.array_file_config,
    metadata: {},
  }

  const updateItem = (i: number, v: unknown) => {
    const next = [...items]
    if (!nestedTemplate && (v === null || v === undefined || v === '')) {
      next.splice(i, 1)
      keys.remove(i)
    } else {
      next[i] = v
    }
    onChange(next.length > 0 ? next : null)
  }

  const removeItem = (i: number) => {
    keys.remove(i)
    const next = items.filter((_, idx) => idx !== i)
    onChange(next.length > 0 ? next : null)
  }

  const addItem = () => {
    keys.add()
    const blank = nestedTemplate || itemType === 'object' ? {} : itemType === 'boolean' ? false : ''
    onChange([...items, blank])
  }

  return (
    <div role="group" aria-label={field.label || field.name} className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic">No items yet.</p>
      )}
      {items.map((item, i) =>
        nestedTemplate ? (
          <div
            key={keys.at(i)}
            role="group"
            aria-label={`Item ${i + 1}`}
            className="border border-gray-200 rounded-md p-2.5 bg-gray-50/50"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500">Item {i + 1}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="p-1 text-gray-300 hover:text-danger"
                  title="Remove item"
                  aria-label={`Remove item ${i + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <NestedObjectInput
              templateRef={nestedTemplate}
              templateVersion={field.array_template_ref_version}
              value={item}
              onChange={(v) => updateItem(i, v)}
              disabled={disabled}
              namespace={namespace}
              idPrefix={`${base}-${i}`}
            />
          </div>
        ) : (
          <div key={keys.at(i)} className="flex items-start gap-2">
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
                className="shrink-0 mt-1 p-1 text-gray-300 hover:text-danger"
                title="Remove item"
                aria-label={`Remove item ${i + 1}`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ),
      )}
      {!disabled && (
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-dark"
        >
          <Plus size={12} /> Add item
        </button>
      )}
    </div>
  )
}

/**
 * One stable key per array item. Keys follow add/remove; when the array's
 * length changes from outside (the document loading), they are regenerated.
 */
function useStableKeys(length: number) {
  const next = useRef(0)
  const keys = useRef<number[]>([])
  if (keys.current.length !== length) {
    keys.current = Array.from({ length }, () => next.current++)
  }
  return {
    at: (i: number) => keys.current[i] ?? -1 - i,
    add: () => { keys.current = [...keys.current, next.current++] },
    remove: (i: number) => { keys.current = keys.current.filter((_, idx) => idx !== i) },
  }
}
