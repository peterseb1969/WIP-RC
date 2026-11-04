import { useState, useCallback } from 'react'
import {
  Key,
  Plus,
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
import { useNamespaces } from '@wip/react'
import type { APIKeyInfo, APIKeyRevokeResult, CreateAPIKeyRequest, CreateAPIKeyResponse, UpdateAPIKeyRequest } from '@wip/client'
import StatusBadge from '@/components/common/StatusBadge'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import AnthropicKeyCard from '@/components/settings/AnthropicKeyCard'
import { KeyEffectivePermissions } from '@/components/grants/GrantsPanel'
import { cn } from '@/lib/cn'
import RefreshButton, { RefreshingValue } from '@/components/common/RefreshButton'
import { buildCreateNamespaces, emptyRow, type NamespaceRow } from '@/lib/key-reservations'
import NamespaceRowsInput from '@/components/api-keys/NamespaceRowsInput'
import KeyNamespacesEditor from '@/components/api-keys/KeyNamespacesEditor'
import { isKeyReadOnly, isManaged, managedKeyHint } from '@/lib/managed-records'
import { ReservationsPanel, RevokeResultBanner } from '@/components/api-keys/ReservationsPanel'
import OrphanedGrantsPanel from '@/components/grants/OrphanedGrantsPanel'
import {
  useAPIKeys,
  useCreateAPIKey,
  useRevokeAPIKey,
  useUpdateAPIKey,
} from '@/hooks/use-api-keys'

// CASE-694: runtime keys live in MongoDB — backups don't cover them and the
// plaintext can't be re-registered, so every restore kills them.
const DECLARE_KEY_CMD = "wip-deploy install --api-key '<json>'"
const RUNTIME_MORTALITY_HINT =
  'Runtime key — not covered by backups; will not survive a restore. ' +
  `For standing keys (agents, services), declare on the deployment: ${DECLARE_KEY_CMD}`
const SHADOWED_HINT = (configKey: string) =>
  `This key does not authenticate: config key '${configKey}' has the same plaintext, ` +
  'and a request with that plaintext acts as the config key.'
const CONFIG_TIER_HINT =
  'Config key — declared on the deployment; survives Mongo rebuilds and restores. Read-only here.'

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
// Tier advisory — shown in the create dialog so the operator picks the key
// tier consciously. Spec-declared keys are deliberately NOT creatable here:
// the declaration is deployer state on the install host, so the ceiling is
// showing the CLI command as copyable guidance (CASE-694).
// ---------------------------------------------------------------------------

function TierAdvisory() {
  const { copied, copy } = useCopyToClipboard()
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
      <p className="text-xs text-amber-700">
        Keys created here are <span className="font-medium">runtime keys</span> — stored in the
        backend database, not covered by backups, and lost on a wipe-and-restore. Right for
        temporary keys, per-app provisioning, and experiments. For standing keys (agents,
        services), declare the key on the deployment instead:
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        <code className="text-[11px] bg-white border border-amber-200 rounded px-2 py-1 text-amber-800 font-mono">
          {DECLARE_KEY_CMD}
        </code>
        <button
          onClick={() => copy(DECLARE_KEY_CMD)}
          className={cn(
            'p-1 rounded border transition-colors',
            copied
              ? 'bg-success/5 border-success/30 text-success'
              : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-100',
          )}
          title="Copy command"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create API Key Form
// ---------------------------------------------------------------------------

function CreateAPIKeyForm({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (created: CreateAPIKeyResponse) => void
}) {
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<NamespaceRow[]>([emptyRow()])
  const [groupsInput, setGroupsInput] = useState('')
  const [grantPermission, setGrantPermission] = useState<'' | 'read' | 'write' | 'admin'>('write')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { data: namespaceList } = useNamespaces()
  const existing = new Set((namespaceList ?? []).map(n => n.prefix))
  const hasPlainNamespace = rows.some(r => r.prefix.trim() && !(r.reserve && !existing.has(r.prefix.trim())))
  const hasNamespace = rows.some(r => r.prefix.trim())

  const create = useCreateAPIKey({
    onSuccess: (data) => onCreated(data),
    onError: (err) => setError(err.message),
  })

  const handleCreate = () => {
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Name is required'); return }
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmedName)) {
      setError('Name must start with a letter and contain only letters, numbers, hyphens, and underscores')
      return
    }

    // A reserved namespace gets admin; the permission is the grant on the
    // others. Without a grant, a scoped key is read-only on a namespace.
    const built = buildCreateNamespaces(rows, existing, grantPermission)
    if ('error' in built) { setError(built.error); return }
    const groups = groupsInput.trim()
      ? groupsInput.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    const req: CreateAPIKeyRequest = {
      name: trimmedName,
      owner: owner.trim() || undefined,
      description: description.trim() || undefined,
      groups: groups?.length ? groups : undefined,
      expires_at: expiresAt || undefined,
      ...built.fields,
    }
    create.mutate(req)
  }

  return (
    <div className="bg-white border border-primary/20 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Create API Key</h3>
      <TierAdvisory />
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="key-name" className="block text-xs text-gray-500 mb-1">Name *</label>
            <input
              id="key-name"
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              placeholder="my-app-key"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="key-owner" className="block text-xs text-gray-500 mb-1">Owner</label>
            <input
              id="key-owner"
              type="text"
              value={owner}
              onChange={e => setOwner(e.target.value)}
              placeholder="user@example.com"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
            />
          </div>
        </div>
        <div>
          <label htmlFor="key-description" className="block text-xs text-gray-500 mb-1">Description</label>
          <input
            id="key-description"
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What this key is used for"
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
          />
        </div>
        <div>
          <p className="block text-xs text-gray-500 mb-1">Namespaces</p>
          <NamespaceRowsInput rows={rows} existing={existing} onChange={r => { setRows(r); setError(null) }} />
          <p className="text-[10px] text-gray-400 mt-1">
            No namespaces means no namespace restriction (privileged).
          </p>
          {rows.some(r => r.reserve) && (
            <p className="text-[11px] text-gray-500 mt-1.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
              Reserving is for apps wip-deploy does not manage. An app wip-deploy manages gets its key
              from wip-deploy and adds namespaces with{' '}
              <code className="font-mono">wip-deploy app-namespace add</code>; a key made here and put
              in that app&apos;s secret is withheld by the Registry.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="key-groups" className="block text-xs text-gray-500 mb-1">
              Groups <span className="text-gray-300">(comma-separated)</span>
            </label>
            <input
              id="key-groups"
              type="text"
              value={groupsInput}
              onChange={e => setGroupsInput(e.target.value)}
              placeholder="admin, readers"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
            />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div>
            <label htmlFor="key-permission" className="block text-xs text-gray-500 mb-1">Permission on namespaces</label>
            <select
              id="key-permission"
              value={grantPermission}
              onChange={e => setGrantPermission(e.target.value as '' | 'read' | 'write' | 'admin')}
              disabled={!hasPlainNamespace}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="">none (read-only fallback)</option>
              <option value="read">read</option>
              <option value="write">write</option>
              <option value="admin">admin</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-0.5 max-w-56">
              {hasPlainNamespace
                ? 'Creates a grant per namespace not reserved. Without one the key is read-only there.'
                : hasNamespace
                  ? 'Reserved namespaces always get admin.'
                  : 'Applies only to namespace-scoped keys.'}
            </p>
          </div>
          <div>
            <label htmlFor="key-expires" className="block text-xs text-gray-500 mb-1">Expires At</label>
            <input
              id="key-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
            />
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            disabled={create.isPending || !name.trim()}
            className="px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
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

function PlaintextKeyBanner({ created, onDismiss }: {
  created: CreateAPIKeyResponse
  onDismiss: () => void
}) {
  const { copied, copy } = useCopyToClipboard()
  const { name, plaintext_key: plaintextKey } = created
  const reserved = created.reserved_namespaces ?? []
  const granted = created.granted_namespaces ?? []

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            API key created: {name}
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            Copy the key now — it cannot be retrieved again. WIP may take up to 30 seconds to accept it.
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
              ? 'bg-success/5 border-success/30 text-success'
              : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-100',
          )}
          title="Copy to clipboard"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      {(reserved.length > 0 || granted.length > 0) && (
        <div className="mt-2 text-xs text-amber-700 space-y-0.5">
          {reserved.length > 0 && (
            <p>Reserves, with admin: <span className="font-mono">{reserved.join(', ')}</span></p>
          )}
          {granted.filter(n => !reserved.includes(n)).length > 0 && (
            <p>Granted on: <span className="font-mono">{granted.filter(n => !reserved.includes(n)).join(', ')}</span></p>
          )}
        </div>
      )}
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
  onRevoked,
}: {
  apiKey: APIKeyInfo
  isExpanded: boolean
  onToggle: () => void
  onRevoked: (result: APIKeyRevokeResult) => void
}) {
  const isConfig = apiKey.source === 'config'
  // wip-deploy's keys (and config keys the Registry has not imported) are
  // changed with wip-deploy, never through the API.
  const managed = isManaged(apiKey)
  const readOnly = isKeyReadOnly(apiKey)
  const reserved = apiKey.reserved_namespaces ?? []
  const isExpired = apiKey.expires_at && new Date(apiKey.expires_at) < new Date()

  const [editing, setEditing] = useState(false)
  const [editDesc, setEditDesc] = useState(apiKey.description ?? '')
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
    onSuccess: (result) => { setRevokeConfirm(false); onRevoked(result) },
    onError: (err) => setRevokeError(err.message),
  })

  const startEdit = () => {
    setEditDesc(apiKey.description ?? '')
    setEditGroups((apiKey.groups ?? []).join(', '))
    setEditEnabled(apiKey.enabled)
    setEditExpiresAt(apiKey.expires_at ? apiKey.expires_at.slice(0, 16) : '')
    update.reset()
    setEditing(true)
  }

  const handleSave = () => {
    const groups = editGroups.trim()
      ? editGroups.split(',').map(s => s.trim()).filter(Boolean)
      : []

    // Namespaces are not sent: they change through KeyNamespacesEditor,
    // which keeps the key's grants and reservations in step with its scope.
    const data: UpdateAPIKeyRequest = {
      description: editDesc.trim() || undefined,
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
          readOnly ? 'text-amber-500' : 'text-primary',
        )} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-800">{apiKey.name}</span>
          {apiKey.description && (
            <span className="text-xs text-gray-400 ml-2">{apiKey.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {managed ? (
            <span
              className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium"
              title={managedKeyHint(apiKey.name)}
            >
              wip-deploy
            </span>
          ) : isConfig ? (
            <span
              className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium"
              title={CONFIG_TIER_HINT}
            >
              config
            </span>
          ) : (
            <span
              className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium"
              title={RUNTIME_MORTALITY_HINT}
            >
              runtime
            </span>
          )}
          {apiKey.origin === 'restored' && (
            <span
              className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium"
              title="Restored from a backup of another install. It is no longer managed by wip-deploy here, and can be edited or revoked."
            >
              restored
            </span>
          )}
          {apiKey.namespaces === null ? (
            <span className="text-[10px] bg-danger/5 text-danger px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
              <Shield size={8} /> privileged
            </span>
          ) : (
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
              <ShieldOff size={8} /> {apiKey.namespaces.length} ns
            </span>
          )}
          {reserved.length > 0 && (
            <span
              className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium"
              title={`Reserves ${reserved.join(', ')}: the key holds admin there and may create the namespace`}
            >
              reserves {reserved.length}
            </span>
          )}
          {apiKey.shadowed_by && (
            <span
              className="text-[10px] bg-danger/5 text-danger px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"
              title={SHADOWED_HINT(apiKey.shadowed_by)}
            >
              <AlertTriangle size={8} /> shadowed
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
            {apiKey.namespaces && readOnly && (
              <span>Namespaces: {apiKey.namespaces.length > 0 ? apiKey.namespaces.join(', ') : 'none'}</span>
            )}
            {apiKey.namespaces === null && (
              <span className="text-amber-500 font-medium">Privileged (all namespaces)</span>
            )}
            {reserved.length > 0 && (
              <span>Reserves: <span className="font-mono">{reserved.join(', ')}</span></span>
            )}
          </div>

          {apiKey.shadowed_by && (
            <p className="text-[11px] text-danger flex items-center gap-1.5">
              <AlertTriangle size={11} className="shrink-0" />
              <span>{SHADOWED_HINT(apiKey.shadowed_by)}</span>
            </p>
          )}

          <div className="flex items-center flex-wrap gap-4 text-xs text-gray-400">
            {apiKey.created_at && (
              <span>Created: {new Date(apiKey.created_at).toLocaleString()}</span>
            )}
            {apiKey.created_by && <span>By: {apiKey.created_by}</span>}
            {apiKey.expires_at && (
              <span className={cn(
                'flex items-center gap-1',
                isExpired && 'text-danger',
              )}>
                <Clock size={10} />
                Expires: {new Date(apiKey.expires_at).toLocaleString()}
                {isExpired && ' (expired)'}
              </span>
            )}
            <span>Source: {apiKey.source}</span>
          </div>

          {!readOnly && (
            <p className="text-[11px] text-amber-600 flex items-center gap-1.5">
              <AlertTriangle size={11} className="shrink-0" />
              <span>
                Not covered by backups — this key will not survive a restore. For standing
                keys, declare it on the deployment:{' '}
                <code className="font-mono text-amber-700">{DECLARE_KEY_CMD}</code>
              </span>
            </p>
          )}

          {!readOnly && apiKey.namespaces !== null && <KeyNamespacesEditor apiKey={apiKey} />}

          {/* Effective per-namespace permissions (scoped keys only) */}
          <KeyEffectivePermissions apiKey={apiKey} />

          {/* Actions */}
          {editing ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Groups (comma-separated)</label>
                  <input
                    type="text"
                    value={editGroups}
                    onChange={e => setEditGroups(e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
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
                    className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
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
              {update.error && <p className="text-xs text-danger">{update.error.message}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={update.isPending}
                  className="px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
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
            <div className="bg-danger/5 border border-danger/20 rounded-lg p-3 space-y-2">
              <p className="text-sm text-danger">
                Revoke API key <strong>{apiKey.name}</strong>? This cannot be undone.
              </p>
              <p className="text-xs text-danger">
                Any applications using this key will lose access within 30 seconds. Its grants are
                revoked{reserved.length > 0
                  ? '; its reservations are released where the namespace was never created and kept where it exists'
                  : ''}. No namespace is deleted.
              </p>
              {revokeError && <p className="text-xs text-danger">{revokeError}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => revoke.mutate(apiKey.name)}
                  disabled={revoke.isPending}
                  className="px-3 py-1.5 bg-danger text-white text-sm rounded-md hover:bg-danger disabled:opacity-50"
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
              {!readOnly && (
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
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-danger/60 hover:text-danger hover:bg-danger/5"
                  >
                    <Trash2 size={12} />
                    Revoke
                  </button>
                </>
              )}
              {managed ? (
                <span className="text-xs text-gray-500" data-testid="managed-key-hint">
                  {managedKeyHint(apiKey.name)}
                </span>
              ) : readOnly && (
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
  const [createdKey, setCreatedKey] = useState<CreateAPIKeyResponse | null>(null)
  const [revokeResult, setRevokeResult] = useState<APIKeyRevokeResult | null>(null)
  const { data: apiKeys, isLoading, isFetching, error, refetch } = useAPIKeys()

  const handleCreated = (created: CreateAPIKeyResponse) => {
    setShowCreate(false)
    setCreatedKey(created)
    setExpandedKey(created.name)
  }

  // APIKeyListResponse became paginated in 0.19+ (PaginatedResponse<APIKeyInfo>).
  // Sort: runtime keys first, then config; within each group alphabetical
  const sorted = apiKeys?.items?.slice().sort((a, b) => {
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
          <RefreshButton onRefresh={() => refetch({ cancelRefetch: false })} refreshing={isFetching && !isLoading} label="Refresh API keys" variant="boxed" size={14} />
          <button
            onClick={() => setShowCreate(s => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark"
          >
            <Plus size={14} />
            Create
          </button>
        </div>
      </div>

      {createdKey && (
        <PlaintextKeyBanner
          created={createdKey}
          onDismiss={() => setCreatedKey(null)}
        />
      )}

      {revokeResult && (
        <RevokeResultBanner result={revokeResult} onDismiss={() => setRevokeResult(null)} />
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
                onRevoked={setRevokeResult}
              />
            ))
          )}
        </div>
      )}

      {sorted && (
        <p className="text-xs text-gray-400">
          <RefreshingValue refreshing={isFetching && !isLoading}>{sorted.length} key{sorted.length !== 1 ? 's' : ''}</RefreshingValue>
          {sorted.filter(k => k.source === 'config').length > 0 && (
            <> ({sorted.filter(k => k.source === 'config').length} config, {sorted.filter(k => k.source === 'runtime').length} runtime)</>
          )}
        </p>
      )}

      <ReservationsPanel />

      <OrphanedGrantsPanel />

      {/* LLM key — distinct from WIP access keys above. Anthropic key for the
          askBar / NL-query feature, settable at runtime (in-memory override). */}
      <div className="pt-2 border-t border-gray-100">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">LLM</h2>
        <AnthropicKeyCard />
      </div>
    </div>
  )
}
