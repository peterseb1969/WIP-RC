import { Plus, Shield } from 'lucide-react'
import type { ValidationRule } from '@wip/client'
import RuleEditor from './RuleEditor'

// ---------------------------------------------------------------------------
// RuleList
// ---------------------------------------------------------------------------

export interface RuleListProps {
  rules: ValidationRule[]
  fieldNames: string[]
  onChange: (rules: ValidationRule[]) => void
}

export default function RuleList({ rules, fieldNames, onChange }: RuleListProps) {
  const addRule = () => {
    onChange([
      ...rules,
      { type: 'conditional_required', conditions: [], error_message: '' },
    ])
  }

  const updateRule = (index: number, rule: ValidationRule) => {
    onChange(rules.map((r, i) => i === index ? rule : r))
  }

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Shield size={12} />
          Validation Rules ({rules.length})
        </h2>
        <button
          type="button"
          onClick={addRule}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:text-primary-dark border border-primary/20 rounded-md hover:bg-primary/5"
        >
          <Plus size={12} />
          Add Rule
        </button>
      </div>
      {rules.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">
          No validation rules. Rules enforce cross-field constraints beyond per-field validation.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, i) => (
            <RuleEditor
              key={i}
              rule={rule}
              fieldNames={fieldNames}
              onChange={(updated) => updateRule(i, updated)}
              onRemove={() => removeRule(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
