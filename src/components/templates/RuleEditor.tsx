import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { ValidationRule, RuleType, Condition, ConditionOperator } from '@wip/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RULE_TYPES: { value: RuleType; label: string; description: string }[] = [
  { value: 'conditional_required', label: 'Conditional Required', description: 'Require target field(s) when conditions are met' },
  { value: 'conditional_value', label: 'Conditional Value', description: 'Restrict target field values when conditions are met' },
  { value: 'mutual_exclusion', label: 'Mutual Exclusion', description: 'Only one of the target fields can have a value' },
  { value: 'dependency', label: 'Dependency', description: 'Target field must exist when conditions are met' },
  { value: 'pattern', label: 'Pattern', description: 'Target field must match a regex pattern' },
  { value: 'range', label: 'Range', description: 'Target field must be within a numeric range' },
]

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '!=' },
  { value: 'in', label: 'in' },
  { value: 'not_in', label: 'not in' },
  { value: 'exists', label: 'exists' },
  { value: 'not_exists', label: 'not exists' },
]

const NEEDS_CONDITION: Set<RuleType> = new Set(['conditional_required', 'conditional_value', 'dependency'])
const NEEDS_TARGET_FIELDS: Set<RuleType> = new Set(['mutual_exclusion'])
const NEEDS_TARGET_FIELD: Set<RuleType> = new Set(['conditional_required', 'conditional_value', 'dependency', 'pattern', 'range'])

// ---------------------------------------------------------------------------
// Condition row
// ---------------------------------------------------------------------------

function ConditionRow({
  condition,
  fieldNames,
  onChange,
  onRemove,
}: {
  condition: Condition
  fieldNames: string[]
  onChange: (c: Condition) => void
  onRemove: () => void
}) {
  const needsValue = condition.operator !== 'exists' && condition.operator !== 'not_exists'
  const isArrayOp = condition.operator === 'in' || condition.operator === 'not_in'

  return (
    <div className="flex items-center gap-2">
      <select
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value })}
        className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="">field...</option>
        {fieldNames.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as ConditionOperator })}
        className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      {needsValue && (
        <input
          type="text"
          value={
            isArrayOp
              ? Array.isArray(condition.value) ? (condition.value as string[]).join(', ') : String(condition.value ?? '')
              : String(condition.value ?? '')
          }
          onChange={(e) => {
            const raw = e.target.value
            const val = isArrayOp
              ? raw.split(',').map(s => s.trim()).filter(Boolean)
              : raw
            onChange({ ...condition, value: val || undefined })
          }}
          placeholder={isArrayOp ? 'val1, val2' : 'value'}
          className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="p-1 text-gray-300 hover:text-red-500"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RuleEditor
// ---------------------------------------------------------------------------

export interface RuleEditorProps {
  rule: ValidationRule
  fieldNames: string[]
  onChange: (rule: ValidationRule) => void
  onRemove: () => void
}

export default function RuleEditor({
  rule,
  fieldNames,
  onChange,
  onRemove,
}: RuleEditorProps) {
  const [expanded, setExpanded] = useState(true)
  const update = (patch: Partial<ValidationRule>) => onChange({ ...rule, ...patch })

  const showConditions = NEEDS_CONDITION.has(rule.type)
  const showTargetField = NEEDS_TARGET_FIELD.has(rule.type)
  const showTargetFields = NEEDS_TARGET_FIELDS.has(rule.type)

  const handleTypeChange = (newType: RuleType) => {
    const cleaned: Partial<ValidationRule> = { type: newType }
    // Reset fields not relevant to new type
    if (!NEEDS_CONDITION.has(newType)) cleaned.conditions = []
    if (!NEEDS_TARGET_FIELD.has(newType)) {
      cleaned.target_field = undefined
      cleaned.required = undefined
    }
    if (!NEEDS_TARGET_FIELDS.has(newType)) cleaned.target_fields = undefined
    if (newType !== 'conditional_value') cleaned.allowed_values = undefined
    if (newType !== 'pattern') cleaned.pattern = undefined
    if (newType !== 'range') { cleaned.minimum = undefined; cleaned.maximum = undefined }
    onChange({ ...rule, ...cleaned })
  }

  const addCondition = () => {
    update({
      conditions: [...(rule.conditions ?? []), { field: '', operator: 'equals' }],
    })
  }

  const updateCondition = (i: number, c: Condition) => {
    const next = [...(rule.conditions ?? [])]
    next[i] = c
    update({ conditions: next })
  }

  const removeCondition = (i: number) => {
    update({ conditions: (rule.conditions ?? []).filter((_, j) => j !== i) })
  }

  const typeInfo = RULE_TYPES.find(t => t.value === rule.type)

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          {expanded ? '−' : '+'}
        </button>
        <select
          value={rule.type}
          onChange={(e) => handleTypeChange(e.target.value as RuleType)}
          className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {RULE_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <span className="flex-1 text-xs text-gray-400 truncate">{typeInfo?.description}</span>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-300 hover:text-red-500"
          title="Remove rule"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-3 py-3 space-y-3">
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={rule.description ?? ''}
              onChange={(e) => update({ description: e.target.value || undefined })}
              placeholder="What this rule enforces"
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Conditions */}
          {showConditions && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600">Conditions</label>
                <button
                  type="button"
                  onClick={addCondition}
                  className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                >
                  <Plus size={10} /> Add condition
                </button>
              </div>
              <div className="space-y-2">
                {(rule.conditions ?? []).map((c, i) => (
                  <ConditionRow
                    key={i}
                    condition={c}
                    fieldNames={fieldNames}
                    onChange={(updated) => updateCondition(i, updated)}
                    onRemove={() => removeCondition(i)}
                  />
                ))}
                {(rule.conditions ?? []).length === 0 && (
                  <p className="text-xs text-gray-400">No conditions. Click "Add condition" above.</p>
                )}
              </div>
            </div>
          )}

          {/* Target field (single) */}
          {showTargetField && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target field</label>
              <select
                value={rule.target_field ?? ''}
                onChange={(e) => update({ target_field: e.target.value || undefined })}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Select field...</option>
                {fieldNames.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          {/* Target fields (multiple) */}
          {showTargetFields && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target fields (comma-separated)</label>
              <input
                type="text"
                value={(rule.target_fields ?? []).join(', ')}
                onChange={(e) => {
                  const items = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  update({ target_fields: items.length > 0 ? items : undefined })
                }}
                placeholder="field_a, field_b"
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          )}

          {/* Type-specific fields */}
          {rule.type === 'conditional_value' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Allowed values (comma-separated)</label>
              <input
                type="text"
                value={(rule.allowed_values ?? []).map(String).join(', ')}
                onChange={(e) => {
                  const items = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  update({ allowed_values: items.length > 0 ? items : undefined })
                }}
                placeholder="value1, value2"
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          )}

          {rule.type === 'pattern' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pattern (regex)</label>
              <input
                type="text"
                value={rule.pattern ?? ''}
                onChange={(e) => update({ pattern: e.target.value || undefined })}
                placeholder="^[A-Z]{2}-\\d+$"
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          )}

          {rule.type === 'range' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Minimum</label>
                <input
                  type="number"
                  value={rule.minimum ?? ''}
                  onChange={(e) => update({ minimum: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Maximum</label>
                <input
                  type="number"
                  value={rule.maximum ?? ''}
                  onChange={(e) => update({ maximum: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          )}

          {/* Error message */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Error message</label>
            <input
              type="text"
              value={rule.error_message ?? ''}
              onChange={(e) => update({ error_message: e.target.value || undefined })}
              placeholder="Shown when validation fails"
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      )}
    </div>
  )
}
