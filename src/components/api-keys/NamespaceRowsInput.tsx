import { Plus, X } from 'lucide-react'
import {
  EXISTING_NAMESPACE_HINT,
  emptyRow,
  type NamespaceRow,
} from '@/lib/key-reservations'
import ReservationSettingsEditor from './ReservationSettingsEditor'

/**
 * The create dialog's namespaces: one row each, typed or picked from the
 * install's namespaces. A namespace that doesn't exist yet can be reserved.
 */
export default function NamespaceRowsInput({ rows, existing, onChange }: {
  rows: NamespaceRow[]
  existing: ReadonlySet<string>
  onChange: (rows: NamespaceRow[]) => void
}) {
  const update = (i: number, patch: Partial<NamespaceRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i))

  return (
    <div className="space-y-2">
      <datalist id="key-namespace-options">
        {[...existing].sort().map(p => <option key={p} value={p} />)}
      </datalist>
      {rows.map((row, i) => {
        const prefix = row.prefix.trim()
        const exists = existing.has(prefix)
        const label = `Namespace ${i + 1}`
        return (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label={label}
                list="key-namespace-options"
                value={row.prefix}
                onChange={e => update(i, { prefix: e.target.value })}
                placeholder="namespace"
                className="flex-1 border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
              />
              <label
                className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer"
                title={exists ? EXISTING_NAMESPACE_HINT : 'Reserve the namespace so the key can create it'}
              >
                <input
                  type="checkbox"
                  checked={row.reserve && !exists}
                  disabled={exists || !prefix}
                  onChange={e => update(i, { reserve: e.target.checked })}
                  aria-label={`Reserve ${prefix || label}`}
                  className="rounded border-gray-300"
                />
                Reserve
              </label>
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-1 text-gray-300 hover:text-danger"
                title="Remove this namespace"
                aria-label={`Remove ${prefix || label}`}
              >
                <X size={14} />
              </button>
            </div>
            {exists && row.reserve && (
              <p className="text-[10px] text-gray-400">{EXISTING_NAMESPACE_HINT}</p>
            )}
            {row.reserve && !exists && prefix && (
              <ReservationSettingsEditor
                prefix={prefix}
                draft={row.draft}
                onChange={draft => update(i, { draft })}
              />
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => onChange([...rows, emptyRow()])}
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-dark"
      >
        <Plus size={12} /> Add namespace
      </button>
    </div>
  )
}
