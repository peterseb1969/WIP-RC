import { useState, useCallback } from 'react'
import { Key, GripVertical, Pencil, Trash2 } from 'lucide-react'
import type { FieldDefinition } from '@wip/client'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Type Badge (shared visual for field types)
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-success/10 text-success',
  number: 'bg-primary/10 text-primary-dark',
  integer: 'bg-primary/10 text-primary-dark',
  boolean: 'bg-yellow-100 text-yellow-700',
  date: 'bg-purple-100 text-purple-700',
  datetime: 'bg-purple-100 text-purple-700',
  term: 'bg-orange-100 text-orange-700',
  reference: 'bg-pink-100 text-pink-700',
  file: 'bg-gray-100 text-gray-700',
  array: 'bg-teal-100 text-teal-700',
  object: 'bg-indigo-100 text-indigo-700',
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn(
      'inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium',
      TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-500'
    )}>
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Field Row
// ---------------------------------------------------------------------------

function FieldRow({
  field,
  index,
  isIdentity,
  isSelected,
  isInherited,
  isDragOver,
  onSelect,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  field: FieldDefinition
  index: number
  isIdentity: boolean
  isSelected: boolean
  isInherited: boolean
  isDragOver: boolean
  onSelect: (index: number) => void
  onRemove: (index: number) => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent, index: number) => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group',
        isSelected && 'bg-primary/5 border-l-2 border-l-blue-500',
        !isSelected && 'hover:bg-gray-50 border-l-2 border-l-transparent',
        isIdentity && !isSelected && 'bg-amber-50/50',
        isInherited && 'opacity-60',
        isDragOver && 'border-t-2 border-t-blue-400',
      )}
      onClick={() => onSelect(index)}
      draggable={!isInherited}
      onDragStart={(e) => {
        if (isInherited) { e.preventDefault(); return }
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(index)
      }}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, index)}
    >
      {/* Drag handle */}
      <GripVertical
        size={14}
        className={cn(
          'shrink-0',
          isInherited ? 'text-gray-200' : 'text-gray-300 cursor-grab active:cursor-grabbing',
        )}
      />

      {/* Field info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-sm font-mono',
            isInherited ? 'text-gray-400' : 'text-gray-800'
          )}>
            {field.name}
          </span>
          {isIdentity && <Key size={12} className="text-amber-500" />}
          {field.mandatory && <span className="text-danger/60 text-xs font-bold">*</span>}
          {isInherited && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
              inherited
            </span>
          )}
        </div>
        {field.label && field.label !== field.name && (
          <p className="text-xs text-gray-400 truncate">{field.label}</p>
        )}
      </div>

      {/* Type + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <TypeBadge type={field.type ?? 'unknown'} />
        {!isInherited && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(index) }}
              className="p-1 text-gray-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit field"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(index) }}
              className="p-1 text-gray-300 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove field"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FieldList
// ---------------------------------------------------------------------------

export interface FieldListProps {
  fields: FieldDefinition[]
  identityFields: string[]
  selectedIndex: number | null
  onSelectField: (index: number) => void
  onRemoveField: (index: number) => void
  onReorder?: (fromIndex: number, toIndex: number) => void
}

export default function FieldList({
  fields,
  identityFields,
  selectedIndex,
  onSelectField,
  onRemoveField,
  onReorder,
}: FieldListProps) {
  const identitySet = new Set(identityFields)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== toIndex && onReorder) {
      onReorder(dragIndex, toIndex)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex, onReorder])

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100"
      onDragOver={(e) => e.preventDefault()}
    >
      {fields.length === 0 ? (
        <p className="text-sm text-gray-400 p-6 text-center">
          No fields yet. Use quick-add below or click "Add Field" to get started.
        </p>
      ) : (
        fields.map((field, i) => (
          <FieldRow
            key={`${field.name}-${i}`}
            field={field}
            index={i}
            isIdentity={identitySet.has(field.name)}
            isSelected={selectedIndex === i}
            isInherited={!!field.inherited}
            isDragOver={dragOverIndex === i && dragIndex !== i}
            onSelect={onSelectField}
            onRemove={onRemoveField}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
          />
        ))
      )}
    </div>
  )
}
