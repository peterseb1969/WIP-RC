import { useState, useCallback } from 'react'
import {
  Key,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Shield,
  ShieldOff,
  Clock,
} from 'lucide-react'
import { useWipClient } from '@wip/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { APIKeyInfo, CreateAPIKeyRequest, UpdateAPIKeyRequest } from '@wip/client'
import StatusBadge from '@/components/common/StatusBadge'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const API_KEY_KEYS = {
  all: ['rc-console', 'api-keys'] as const,
  list: () => [...API_KEY_KEYS.all, 'list'] as const,
}

// ---------------------------------------------------------------------------
// Hooks (no @wip/react hooks for API keys yet)
// ---------------------------------------------------------------------------

function useAPIKeys() {
  const client = useWipClient()
  return useQuery({
    queryKey: API_KEY_KEYS.list(),
    queryFn: () => client.registry.listAPIKeys(),
    staleTime: 30_000,
  })
}

function useCreateAPIKey(options?: { onSuccess?: (data: { plaintext_key: string } & APIKeyInfo) => void; onError?: (err: Error) => void }) {
  const client = useWipClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateAPIKeyRequest) => client.registry.createAPIKey(req),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: API_KEY_KEYS.all })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

function useUpdateAPIKey(options?: { onSuccess?: () => void; onError?: (err: Error) => void }) {
  const client = useWipClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateAPIKeyRequest }) =>
      client.registry.updateAPIKey(name, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: API_KEY_KEYS.all })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

function useRevokeAPIKey(options?: { onSuccess?: () => void; onError?: (err: Error) => void }) {
  const client = useWipClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => client.registry.revokeAPIKey(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: API_KEY_KEYS.all })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

// ---------------------------------------------------------------------------
// Copy to clipboard helper
// ---------------------------------------------------------------------------

function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])
  return { copied, copy }
}

// ---------------------------------------------------------------------------
// Create API Key Form
// ---------------------------------------------------------------------------

function CreateAPIKeyForm({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (name: string, plaintextKey: string) => void
}) {
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [description, setDescription] = useState('')
  const [namespacesInput, setNamespacesInput] = useState('')
  const [groupsInput, setGroupsInput] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useCreateAPIKey({
    onSuccess: (data) => onCreated(data.name, data.plaintext_key),
    onError: (err) => setError(err.message),
  })

  const handleCreate = () => {
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Name is required'); return }
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmedName)) {
      setError('Name must start with a letter and contain only letters, numbers, hyphens, and underscores')
      return
    }

    const namespaces = namespacesInput.trim()
      ? namespacesInput.split(',').map(s => s.trim()).filter(Boolean)
      : undefined
    const groups = groupsInput.trim()
      ? groupsInput.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    const req: CreateAPIKeyRequest = {
      name: trimmedName,
      owner: owner.trim() || undefined,
      description: description.trim() || undefined,
      namespaces: namespaces?.length ? namespaces : undefined,
      groups: groups?.length ? groups : undefined,
      expires_at: expiresAt || undefined,
    }
    create.mutate(req)
  }

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Create API Key</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              placeholder="my-app-key"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Owner</label>
            <input
              type="text"
              value={owner}
              onChange={e => setOwner(e.target.value)}
              placeholder="user@example.com"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What this key is used for"
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Namespaces <span className="text-gray-300">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={namespacesInput}
              onChange={e => setNamespacesInput(e.target.value)}
              placeholder="ns-one, ns-two"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Leave empty for no namespace restriction (privileged)
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Groups <span className="text-gray-300">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={groupsInput}
              onChange={e => setGroupsInput(e.target.value)}
              placeholder="admin, readers"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Expires At</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            disabled={create.isPending || !name.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {create.isPending ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plaintext Key Display (shown once after creation)
// ---------------------------------------------------------------------------

function PlaintextKeyBanner({ name, plaintextKey, onDismiss }: {
  name: string
  plaintextKey: string
  onDismiss: () => void
}) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            API key created: {name}
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            Copy the key now — it cannot be retrieved again.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <code className="flex-1 bg-white border border-amber-200 rounded px-3 py-2 text-sm font-mono text-gray-800 break-all select-all">
          {plaintextKey}
        </code>
        <button
          onClick={() => copy(plaintextKey)}
          className={cn(
            'shrink-0 p-2 rounded-md border transition-colors',
            copied
              ? 'bg-green-50 border-green-300 text-green-600'
              : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-100',
          )}
          title="Copy to clipboard"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-[10px] text-amber-500">
          Propagation may take up to 30 seconds.
        </p>
        <button
          onClick={onDismiss}
          className="text-xs text-amber-600 hover:text-amber-800 underline"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// API Key Row
// ---------------------------------------------------------------------------

function APIKeyRow({
  apiKey,
  isExpanded,
  onToggle,
}: {
  apiKey: APIKeyInfo
  isExpanded: boolean
  onToggle: () => void
}) {
  const isConfig = apiKey.source === 'config'
  const isExpired = apiKey.expires_at && new Date(apiKey.expires_at) < new Date()

  const [editing, setEditing] = useState(false)
  const [editDesc, setEditDesc] = useState(apiKey.description ?? '')
  const [editNamespaces, setEditNamespaces] = useState((apiKey.namespaces ?? []).join(', '))
  const [editGroups, setEditGroups] = useState((apiKey.groups ?? []).join(', '))
  const [editEnabled, setEditEnabled] = useState(apiKey.enabled)
  const [editExpiresAt, setEditExpiresAt] = useState(
    apiKey.expires_at ? apiKey.expires_at.slice(0, 16) : '',
  )

  const [revokeConfirm, setRevokeConfirm] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const update = useUpdateAPIKey({
    onSuccess: () => setEditing(false),
  })

  const revoke = useRevokeAPIKey({
    onSuccess: () => { setRevokeConfirm(false) },
    onError: (err) => setRevokeError(err.message),
  })

  const startEdit = () => {
    setEditDesc(apiKey.description ?? '')
    setEditNamespaces((apiKey.namespaces ?? []).join(', '))
    setEditGroups((apiKey.groups ?? []).join(', '))
    setEditEnabled(apiKey.enabled)
    setEditExpiresAt(apiKey.expires_at ? apiKey.expires_at.slice(0, 16) : '')
    update.reset()
    setEditing(true)
  }

  const handleSave = () => {
    const namespaces = editNamespaces.trim()
      ? editNamespaces.split(',').map(s => s.trim()).filter(Boolean)
      : null
    const groups = editGroups.trim()
      ? editGroups.split(',').map(s => s.trim()).filter(Boolean)
      : []

    const data: UpdateAPIKeyRequest = {
      description: editDesc.trim() || undefined,
      namespaces,
      groups,
      enabled: editEnabled,
      expires_at: editExpiresAt || undefined,
    }
    update.mutate({ name: apiKey.name, data })
  }

  const statusLabel = !apiKey.enabled ? 'disabled' : isExpired ? 'expired' : 'active'
  const statusType = !apiKey.enabled ? 'inactive' : isExpired ? 'inactive' : 'active'

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        {isExpanded
          ? <ChevronDown size={14} className="text-gray-400" />
          : <ChevronRight size={14} className="text-gray-400" />
        }
        <Key size={16} className={cn(
          'shrink-0',
          isConfig ? 'text-amber-500' : 'text-blue-500',
        )} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-800">{apiKey.name}</span>
          {apiKey.description && (
            <span className="text-xs text-gray-400 ml-2">{apiKey.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConfig && (
            <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium">
              config
            </span>
          )}
          {apiKey.namespaces === null ? (
            <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
              <Shield size={8} /> privileged
            </span>
          ) : (
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
              <ShieldOff size={8} /> {apiKey.namespaces.length} ns
            </span>
          )}
          <StatusBadge status={statusType} label={statusLabel} />
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 pl-12 space-y-3">
          {/* Details */}
          <div className="flex items-center flex-wrap gap-4 text-xs text-gray-400">
            <span>Owner: {apiKey.owner || '—'}</span>
            {apiKey.groups?.length > 0 && (
              <span>Groups: {apiKey.groups.join(', ')}</span>
            )}
            {apiKey.namespaces && (
              <span>Namespaces: {apiKey.namespaces.length > 0 ? apiKey.namespaces.join(', ') : 'none'}</span>
            )}
            {apiKey.namespaces === null && (
              <span className="text-amber-500 font-medium">Privileged (all namespaces)</span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-4 text-xs text-gray-400">
            {apiKey.created_at && (
              <span>Created: {new Date(apiKey.created_at).toLocaleString()}</span>
            )}
            {apiKey.created_by && <span>By: {apiKey.created_by}</span>}
            {apiKey.expires_at && (
              <span className={cn(
                'flex items-center gap-1',
                isExpired && 'text-red-500',
              )}>
                <Clock size={10} />
                Expires: {new Date(apiKey.expires_at).toLocaleString()}
                {isExpired && ' (expired)'}
              </span>
            )}
            <span>Source: {apiKey.source}</span>
          </div>

          {/* Actions */}
          {editing ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Namespaces (comma-separated)</label>
                  <input
                    type="text"
                    value={editNamespaces}
                    onChange={e => setEditNamespaces(e.target.value)}
                    placeholder="Leave empty for privileged access"
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Groups (comma-separated)</label>
                  <input
                    type="text"
                    value={editGroups}
                    onChange={e => setEditGroups(e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Expires At</label>
                  <input
                    type="datetime-local"
                    value={editExpiresAt}
                    onChange={e => setEditExpiresAt(e.target.value)}
                    className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEnabled}
                      onChange={e => setEditEnabled(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-600">Enabled</span>
                  </label>
                </div>
              </div>
              {update.error && <p className="text-xs text-red-500">{update.error.message}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={update.isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {update.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : revokeConfirm ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-red-700">
                Revoke API key <strong>{apiKey.name}</strong>? This cannot be undone.
              </p>
              <p className="text-xs text-red-500">
                Any applications using this key will lose access within 30 seconds.
              </p>
              {revokeError && <p className="text-xs text-red-500">{revokeError}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => revoke.mutate(apiKey.name)}
                  disabled={revoke.isPending}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {revoke.isPending ? 'Revoking...' : 'Yes, revoke'}
                </button>
                <button
                  onClick={() => { setRevokeConfirm(false); setRevokeError(null) }}
                  className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {!isConfig && (
                <>
                  <button
                    onClick={startEdit}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                  <button
                    onClick={() => { setRevokeConfirm(true); setRevokeError(null) }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={12} />
                    Revoke
                  </button>
                </>
              )}
              {isConfig && (
                <span className="text-xs text-gray-400 italic">
                  Config keys are read-only — edit in config/api-keys.*.json
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// API Keys Page
// ---------------------------------------------------------------------------

export default function APIKeysPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<{ name: string; key: string } | null>(null)
  const { data: apiKeys, isLoading, error, refetch } = useAPIKeys()

  const handleCreated = (name: string, plaintextKey: string) => {
    setShowCreate(false)
    setCreatedKey({ name, key: plaintextKey })
    setExpandedKey(name)
  }

  // Sort: runtime keys first, then config; within each group alphabetical
  const sorted = apiKeys?.slice().sort((a, b) => {
    if (a.source !== b.source) return a.source === 'runtime' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">API Keys</h1>
          <p className="text-sm text-gray-400 mt-1">Manage API keys for WIP access</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 border border-gray-200 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowCreate(s => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            <Plus size={14} />
            Create
          </button>
        </div>
      </div>

      {createdKey && (
        <PlaintextKeyBanner
          name={createdKey.name}
          plaintextKey={createdKey.key}
          onDismiss={() => setCreatedKey(null)}
        />
      )}

      {showCreate && (
        <CreateAPIKeyForm
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {isLoading && <LoadingState label="Loading API keys..." />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {sorted && (
        <div className="bg-white border border-gray-200 rounded-lg">
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400 p-6 text-center">No API keys found.</p>
          ) : (
            sorted.map(k => (
              <APIKeyRow
                key={k.name}
                apiKey={k}
                isExpanded={expandedKey === k.name}
                onToggle={() => setExpandedKey(prev => prev === k.name ? null : k.name)}
              />
            ))
          )}
        </div>
      )}

      {sorted && (
        <p className="text-xs text-gray-400">
          {sorted.length} key{sorted.length !== 1 ? 's' : ''}
          {sorted.filter(k => k.source === 'config').length > 0 && (
            <> ({sorted.filter(k => k.source === 'config').length} config, {sorted.filter(k => k.source === 'runtime').length} runtime)</>
          )}
        </p>
      )}
    </div>
  )
}
