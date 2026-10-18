import { useState } from 'react'
import { ChevronLeft, ChevronRight, Hash } from 'lucide-react'
import JsonViewer from '@/components/common/JsonViewer'

/** Display label for a document's _id: the plain id, or the hex of an Extended JSON `{"$oid": …}`. */
export function documentIdLabel(doc: Record<string, unknown>, fallback: string): string {
  const id = doc._id
  if (typeof id === 'string' || typeof id === 'number') return String(id)
  if (id && typeof id === 'object' && typeof (id as { $oid?: unknown }).$oid === 'string') return (id as { $oid: string }).$oid
  return id === undefined ? fallback : JSON.stringify(id)
}

/** Expandable list of MongoDB documents, one row per document, JSON on expand. */
export default function DocumentList({ documents }: { documents: Record<string, unknown>[] }) {
  const [selected, setSelected] = useState<number | null>(null)
  return (
    <div className="space-y-2">
      {documents.map((doc, i) => {
        const id = documentIdLabel(doc, `row ${i + 1}`)
        const isSelected = selected === i
        return (
          <div key={`${id}-${i}`} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setSelected(isSelected ? null : i)}
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-sm"
            >
              <Hash size={12} className="text-gray-300" />
              <span className="font-mono text-xs text-gray-500 truncate flex-1">{id}</span>
              {isSelected ? <ChevronLeft size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
            </button>
            {isSelected && (
              <div className="border-t border-gray-200">
                <JsonViewer data={doc} maxHeight="400px" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
