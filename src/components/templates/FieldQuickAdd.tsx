import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { FieldDefinition, FieldType } from '@wip/client'
import { cn } from '@/lib/cn'

const QUICK_TYPES: FieldType[] = [
  'string', 'number', 'integer', 'boolean',
  'date', 'datetime', 'term', 'reference', 'file',
]

export interface FieldQuickAddProps {
  onAdd: (field: FieldDefinition) => void
  existingNames: Set<string>
}

export default function FieldQuickAdd({ onAdd, existingNames }: FieldQuickAddProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<FieldType>('string')
  const [mandatory, setMandatory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required'); return }
    if (!/^[a-z][a-z0-9_]*$/.test(trimmed)) {
      setError('Use snake_case (e.g. first_name)')
      return
    }
    if (existingNames.has(trimmed)) {
      setError('Field name already exists')
      return
    }

    onAdd({
      name: trimmed,
      label: trimmed.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      type,
      mandatory,
      metadata: {},
    })

    setName('')
    setType('string')
    setMandatory(false)
    setError(null)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 border-t-0 rounded-b-lg"
    >
      <Plus size={14} className="text-gray-400 shrink-0" />
      <input
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')); setError(null) }}
        placeholder="field_name"
        className={cn(
          'flex-1 min-w-0 border rounded-md px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary-light',
          error ? 'border-danger/30' : 'border-gray-200'
        )}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e) }}
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as FieldType)}
        className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
      >
        {QUICK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={mandatory}
          onChange={(e) => setMandatory(e.target.checked)}
          className="rounded border-gray-300 text-primary"
        />
        Required
      </label>
      <button
        type="submit"
        className="px-2 py-1 bg-primary text-white text-xs rounded-md hover:bg-primary-dark shrink-0"
      >
        Add
      </button>
      {error && <span className="text-xs text-danger shrink-0">{error}</span>}
    </form>
  )
}
