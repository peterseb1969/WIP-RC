import { Plus, Minus, ArrowRight, Key, Shield } from 'lucide-react'
import type { FieldDefinition, ValidationRule } from '@wip/client'
import { TypeBadge } from './FieldList'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Diff computation
// ---------------------------------------------------------------------------

interface FieldDiff {
  type: 'added' | 'removed' | 'changed' | 'unchanged'
  name: string
  old?: FieldDefinition
  new?: FieldDefinition
  changes?: PropertyChange[]
}

interface PropertyChange {
  property: string
  oldValue: string
  newValue: string
}

function stringifyValue(v: unknown): string {
  if (v === undefined || v === null) return '(none)'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function diffFields(
  oldFields: FieldDefinition[],
  newFields: FieldDefinition[],
): FieldDiff[] {
  const oldMap = new Map(oldFields.map(f => [f.name, f]))
  const newMap = new Map(newFields.map(f => [f.name, f]))
  const result: FieldDiff[] = []

  // Check all new fields (includes changed and added)
  for (const nf of newFields) {
    const of_ = oldMap.get(nf.name)
    if (!of_) {
      result.push({ type: 'added', name: nf.name, new: nf })
      continue
    }
    // Compare properties
    const changes: PropertyChange[] = []
    const props: (keyof FieldDefinition)[] = [
      'label', 'type', 'mandatory', 'default_value',
      'terminology_ref', 'template_ref', 'reference_type',
      'version_strategy', 'semantic_type', 'include_subtypes',
      'array_item_type', 'array_terminology_ref', 'array_template_ref',
    ]
    for (const prop of props) {
      const ov = stringifyValue(of_[prop])
      const nv = stringifyValue(nf[prop])
      if (ov !== nv) {
        changes.push({ property: prop, oldValue: ov, newValue: nv })
      }
    }
    // Deep compare validation
    const ovStr = JSON.stringify(of_.validation ?? null)
    const nvStr = JSON.stringify(nf.validation ?? null)
    if (ovStr !== nvStr) {
      changes.push({ property: 'validation', oldValue: ovStr === 'null' ? '(none)' : ovStr, newValue: nvStr === 'null' ? '(none)' : nvStr })
    }
    // Deep compare file_config
    const ofcStr = JSON.stringify(of_.file_config ?? null)
    const nfcStr = JSON.stringify(nf.file_config ?? null)
    if (ofcStr !== nfcStr) {
      changes.push({ property: 'file_config', oldValue: ofcStr === 'null' ? '(none)' : ofcStr, newValue: nfcStr === 'null' ? '(none)' : nfcStr })
    }

    if (changes.length > 0) {
      result.push({ type: 'changed', name: nf.name, old: of_, new: nf, changes })
    } else {
      result.push({ type: 'unchanged', name: nf.name, old: of_, new: nf })
    }
  }

  // Check removed fields
  for (const of_ of oldFields) {
    if (!newMap.has(of_.name)) {
      result.push({ type: 'removed', name: of_.name, old: of_ })
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Identity diff
// ---------------------------------------------------------------------------

interface IdentityDiff {
  added: string[]
  removed: string[]
  unchanged: string[]
}

function diffIdentity(old: string[], current: string[]): IdentityDiff {
  const oldSet = new Set(old)
  const newSet = new Set(current)
  return {
    added: current.filter(f => !oldSet.has(f)),
    removed: old.filter(f => !newSet.has(f)),
    unchanged: current.filter(f => oldSet.has(f)),
  }
}

// ---------------------------------------------------------------------------
// Rule diff
// ---------------------------------------------------------------------------

interface RuleDiff {
  added: number
  removed: number
  changed: number
}

function diffRules(old: ValidationRule[], current: ValidationRule[]): RuleDiff {
  const added = Math.max(0, current.length - old.length)
  const removed = Math.max(0, old.length - current.length)
  let changed = 0
  const minLen = Math.min(old.length, current.length)
  for (let i = 0; i < minLen; i++) {
    if (JSON.stringify(old[i]) !== JSON.stringify(current[i])) changed++
  }
  return { added, removed, changed }
}

// ---------------------------------------------------------------------------
// TemplateDiffView
// ---------------------------------------------------------------------------

export interface TemplateDiffViewProps {
  originalFields: FieldDefinition[]
  currentFields: FieldDefinition[]
  originalIdentity: string[]
  currentIdentity: string[]
  originalRules: ValidationRule[]
  currentRules: ValidationRule[]
}

export default function TemplateDiffView({
  originalFields,
  currentFields,
  originalIdentity,
  currentIdentity,
  originalRules,
  currentRules,
}: TemplateDiffViewProps) {
  const fieldDiffs = diffFields(originalFields, currentFields)
  const identityDiff = diffIdentity(originalIdentity, currentIdentity)
  const ruleDiff = diffRules(originalRules, currentRules)

  const hasFieldChanges = fieldDiffs.some(d => d.type !== 'unchanged')
  const hasIdentityChanges = identityDiff.added.length > 0 || identityDiff.removed.length > 0
  const hasRuleChanges = ruleDiff.added > 0 || ruleDiff.removed > 0 || ruleDiff.changed > 0
  const hasAnyChange = hasFieldChanges || hasIdentityChanges || hasRuleChanges

  if (!hasAnyChange) {
    return (
      <p className="text-xs text-gray-400 text-center py-3">No changes detected.</p>
    )
  }

  const added = fieldDiffs.filter(d => d.type === 'added')
  const removed = fieldDiffs.filter(d => d.type === 'removed')
  const changed = fieldDiffs.filter(d => d.type === 'changed')

  return (
    <div className="space-y-3">
      {/* Summary line */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        {added.length > 0 && (
          <span className="flex items-center gap-1 text-green-600">
            <Plus size={10} /> {added.length} added
          </span>
        )}
        {removed.length > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <Minus size={10} /> {removed.length} removed
          </span>
        )}
        {changed.length > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <ArrowRight size={10} /> {changed.length} changed
          </span>
        )}
        {hasIdentityChanges && (
          <span className="flex items-center gap-1 text-amber-600">
            <Key size={10} /> identity changed
          </span>
        )}
        {hasRuleChanges && (
          <span className="flex items-center gap-1 text-purple-600">
            <Shield size={10} /> rules modified
          </span>
        )}
      </div>

      {/* Field changes */}
      {hasFieldChanges && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
          {/* Added fields */}
          {added.map(d => (
            <div key={d.name} className="flex items-center gap-2 px-3 py-2 bg-green-50">
              <Plus size={12} className="text-green-600 shrink-0" />
              <span className="font-mono text-green-800">{d.name}</span>
              <TypeBadge type={d.new!.type} />
              {d.new!.mandatory && <span className="text-red-400 text-xs font-bold">*</span>}
            </div>
          ))}

          {/* Removed fields */}
          {removed.map(d => (
            <div key={d.name} className="flex items-center gap-2 px-3 py-2 bg-red-50">
              <Minus size={12} className="text-red-600 shrink-0" />
              <span className="font-mono text-red-800 line-through">{d.name}</span>
              <TypeBadge type={d.old!.type} />
            </div>
          ))}

          {/* Changed fields */}
          {changed.map(d => (
            <div key={d.name} className="px-3 py-2 bg-amber-50/50">
              <div className="flex items-center gap-2">
                <ArrowRight size={12} className="text-amber-600 shrink-0" />
                <span className="font-mono text-amber-800">{d.name}</span>
                <TypeBadge type={d.new!.type} />
              </div>
              <div className="ml-6 mt-1 space-y-0.5">
                {d.changes!.map((c, i) => (
                  <div key={i} className="text-xs text-gray-600">
                    <span className="text-gray-400">{c.property}:</span>{' '}
                    <span className="text-red-500 line-through">{c.oldValue}</span>{' '}
                    <ArrowRight size={8} className="inline text-gray-400" />{' '}
                    <span className="text-green-600">{c.newValue}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Identity changes */}
      {hasIdentityChanges && (
        <div className={cn(
          'border rounded-lg px-3 py-2',
          'border-amber-300 bg-amber-50',
        )}>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1">
            <Key size={12} />
            Identity Fields Changed
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {identityDiff.removed.map(f => (
              <span key={f} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded line-through">{f}</span>
            ))}
            {identityDiff.unchanged.map(f => (
              <span key={f} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{f}</span>
            ))}
            {identityDiff.added.map(f => (
              <span key={f} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Rule changes */}
      {hasRuleChanges && (
        <div className="border border-purple-200 rounded-lg px-3 py-2 bg-purple-50/50">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 mb-1">
            <Shield size={12} />
            Validation Rules
          </div>
          <div className="flex gap-3 text-xs text-purple-600">
            {ruleDiff.added > 0 && <span>+{ruleDiff.added} added</span>}
            {ruleDiff.removed > 0 && <span>-{ruleDiff.removed} removed</span>}
            {ruleDiff.changed > 0 && <span>{ruleDiff.changed} modified</span>}
          </div>
        </div>
      )}
    </div>
  )
}
