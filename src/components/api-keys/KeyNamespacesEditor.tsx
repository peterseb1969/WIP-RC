import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useNamespaces } from '@wip/react'
import type { APIKeyInfo, AddAPIKeyNamespaceRequest } from '@wip/client'
import {
  EXISTING_NAMESPACE_HINT,
  defaultDraft,
  draftToSettings,
  narrowOutcome,
  type GrantLevel,
} from '@/lib/key-reservations'
import { useAddKeyNamespace, useRemoveKeyNamespace } from '@/hooks/use-api-keys'
import ReservationSettingsEditor from './ReservationSettingsEditor'

type AddMode = GrantLevel | 'reserve'

/**
 * A runtime key's namespaces, changed one at a time through the Registry's
 * widen and narrow calls. Those keep the key's scope, its grant on the
 * namespace and any reservation together. The key update (PATCH) changes
 * the scope alone: a namespace dropped there would keep its grant, and one
 * added there would get none, so namespaces are never edited through it.
 */
export default function KeyNamespacesEditor({ apiKey }: { apiKey: APIKeyInfo }) {
  const namespaces = apiKey.namespaces ?? []
  const reserved = new Set(apiKey.reserved_namespaces ?? [])
  const { data: namespaceList } = useNamespaces()
  const existing = new Set((namespaceList ?? []).map(n => n.prefix))

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [prefix, setPrefix] = useState('')
  const [mode, setMode] = useState<AddMode>('write')
  const [draft, setDraft] = useState(defaultDraft())

  const trimmed = prefix.trim()
  const prefixExists = existing.has(trimmed)
  const effectiveMode: AddMode = mode === 'reserve' && prefixExists ? 'admin' : mode

  const remove = useRemoveKeyNamespace({
    onSuccess: (result) => { setConfirmRemove(null); setError(null); setMessage(narrowOutcome(result)) },
    onError: (err) => setError(err.message),
  })
  const add = useAddKeyNamespace({
    onSuccess: () => {
      setMessage(effectiveMode === 'reserve'
        ? `Added ${trimmed}, reserved, with admin.`
        : `Added ${trimmed} with ${effectiveMode}.`)
      setError(null)
      setAdding(false)
      setPrefix('')
      setMode('write')
      setDraft(defaultDraft())
    },
    onError: (err) => setError(err.message),
  })

  const handleAdd = () => {
    if (!trimmed) { setError('Name the namespace to add'); return }
    if (namespaces.includes(trimmed)) { setError(`The key already has ${trimmed}`); return }
    let request: AddAPIKeyNamespaceRequest
    if (effectiveMode === 'reserve') {
      const result = draftToSettings(draft)
      if ('error' in result) { setError(result.error); return }
      request = { reserve: result.settings }
    } else {
      request = { permission: effectiveMode }
    }
    setMessage(null)
    add.mutate({ name: apiKey.name, prefix: trimmed, request })
  }

  return (
    <div className="space-y-2" role="group" aria-label={`Namespaces of ${apiKey.name}`}>
      <p className="text-xs font-medium text-gray-500">Namespaces</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {namespaces.length === 0 && <span className="text-xs text-gray-400">none</span>}
        {namespaces.map(ns => (
          <span
            key={ns}
            className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5 font-mono"
          >
            {ns}
            {reserved.has(ns) && (
              <span className="text-[9px] font-sans bg-primary/10 text-primary rounded px-1">reserved</span>
            )}
            <button
              type="button"
              onClick={() => { setConfirmRemove(ns); setMessage(null); setError(null) }}
              className="text-gray-300 hover:text-danger"
              aria-label={`Remove ${ns} from ${apiKey.name}`}
              title="Remove this namespace from the key"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {!adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setMessage(null); setError(null) }}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-dark"
          >
            <Plus size={12} /> Add namespace
          </button>
        )}
      </div>

      {confirmRemove && (
        <div className="bg-danger/5 border border-danger/20 rounded-md p-2 space-y-1.5">
          <p className="text-xs text-danger">
            Remove <span className="font-mono">{confirmRemove}</span> from {apiKey.name}? The key&apos;s grant
            there is revoked.
            {reserved.has(confirmRemove) && ' Its reservation is released if the namespace was never created, and kept otherwise.'}
            {' '}The namespace itself is not touched.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => remove.mutate({ name: apiKey.name, prefix: confirmRemove })}
              disabled={remove.isPending}
              className="px-2.5 py-1 bg-danger text-white text-xs rounded-md disabled:opacity-50"
            >
              {remove.isPending ? 'Removing...' : 'Yes, remove'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(null)}
              className="px-2.5 py-1 border border-gray-200 text-xs rounded-md text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {adding && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-2.5 space-y-2">
          <datalist id={`add-ns-options-${apiKey.name}`}>
            {[...existing].filter(p => !namespaces.includes(p)).sort().map(p => <option key={p} value={p} />)}
          </datalist>
          <div className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Namespace to add"
              list={`add-ns-options-${apiKey.name}`}
              value={prefix}
              onChange={e => { setPrefix(e.target.value); setError(null) }}
              placeholder="namespace"
              className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary-light"
            />
            <select
              aria-label="Access on the added namespace"
              value={effectiveMode}
              onChange={e => setMode(e.target.value as AddMode)}
              className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary-light"
            >
              <option value="read">read</option>
              <option value="write">write</option>
              <option value="admin">admin</option>
              <option value="reserve" disabled={prefixExists}>reserve (admin)</option>
            </select>
            <button
              type="button"
              onClick={handleAdd}
              disabled={add.isPending || !trimmed}
              className="px-2.5 py-1 bg-primary text-white text-xs rounded-md hover:bg-primary-dark disabled:opacity-50"
            >
              {add.isPending ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setError(null) }}
              className="px-2.5 py-1 border border-gray-200 text-xs rounded-md text-gray-500 hover:bg-white"
            >
              Cancel
            </button>
          </div>
          {prefixExists && mode === 'reserve' && (
            <p className="text-[10px] text-gray-400">{EXISTING_NAMESPACE_HINT}</p>
          )}
          {effectiveMode === 'reserve' && trimmed && (
            <ReservationSettingsEditor prefix={trimmed} draft={draft} onChange={setDraft} />
          )}
        </div>
      )}

      {message && <p className="text-xs text-success">{message}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
