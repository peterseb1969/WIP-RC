import { useState } from 'react'
import { Key, Plus, ShieldCheck, Trash2, Clock, UserRound, Users } from 'lucide-react'
import { useWipClient } from '@wip/react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import type { APIKeyInfo, Grant, GrantPermission, GrantSubjectType } from '@wip/client'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Namespace grants — list / create / revoke (CASE-450 permission model).
//
// A key's `namespaces` list is scoping only (the hard ceiling); the actual
// permission level lives in per-namespace grant rows keyed on
// (namespace, subject, subject_type). Resolution takes the highest
// non-expired grant; an in-scope key with no grant falls back to read.
// ---------------------------------------------------------------------------

export const GRANTS_QUERY_KEY = (prefix: string) =>
  ['rc-console', 'grants', prefix] as const

// CASE-693/CASE-694: the registry serves `grants` on config keys, but
// @wip/client 0.34.0 does not type the field yet — remove once it does.
export type APIKeyWithGrants = APIKeyInfo & {
  grants?: Record<string, GrantPermission> | null
}

export function useGrants(prefix: string, enabled = true) {
  const client = useWipClient()
  return useQuery({
    queryKey: GRANTS_QUERY_KEY(prefix),
    queryFn: () => client.registry.listGrants(prefix),
    enabled,
    staleTime: 30_000,
  })
}

const SUBJECT_TYPE_ICONS: Record<GrantSubjectType, React.ReactNode> = {
  user: <UserRound size={12} className="text-gray-400" />,
  group: <Users size={12} className="text-gray-400" />,
  api_key: <Key size={12} className="text-gray-400" />,
}

export function PermissionBadge({ permission, className }: { permission: string; className?: string }) {
  return (
    <span className={cn(
      'text-[10px] px-1.5 py-0.5 rounded font-medium',
      permission === 'admin' ? 'bg-amber-100 text-amber-700' :
      permission === 'write' ? 'bg-primary/10 text-primary' :
      permission === 'read' ? 'bg-gray-100 text-gray-600' :
      'bg-gray-50 text-gray-400',
      className,
    )}>
      {permission}
    </span>
  )
}

function AddGrantForm({ prefix, onClose }: { prefix: string; onClose: () => void }) {
  const client = useWipClient()
  const qc = useQueryClient()
  const [subject, setSubject] = useState('')
  const [subjectType, setSubjectType] = useState<GrantSubjectType>('api_key')
  const [permission, setPermission] = useState<GrantPermission>('read')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const res = await client.registry.createGrants(prefix, [{
        subject: subject.trim(),
        subject_type: subjectType,
        permission,
        expires_at: expiresAt || undefined,
      }])
      // Bulk-first: HTTP 200 can still carry a per-item error.
      const item = res.results[0]
      if (item?.status === 'error') throw new Error(item.error ?? 'Grant creation failed')
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY(prefix) })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Subject *</label>
          <input
            type="text"
            value={subject}
            onChange={e => { setSubject(e.target.value); setError(null) }}
            placeholder={subjectType === 'api_key' ? 'key name' : subjectType === 'group' ? 'group name' : 'user email'}
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Subject Type</label>
          <select
            value={subjectType}
            onChange={e => setSubjectType(e.target.value as GrantSubjectType)}
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
          >
            <option value="api_key">api_key</option>
            <option value="user">user</option>
            <option value="group">group</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Permission</label>
          <select
            value={permission}
            onChange={e => setPermission(e.target.value as GrantPermission)}
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
          >
            <option value="read">read</option>
            <option value="write">write</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Expires At <span className="text-gray-300">(optional)</span></label>
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={e => setExpiresAt(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
        />
      </div>
      {subjectType === 'api_key' && (
        <p className="text-[10px] text-gray-400">
          Subject is the bare key name. The grant only takes effect if the namespace is also in the key's scoping list.
        </p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || !subject.trim()}
          className="px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {create.isPending ? 'Granting...' : 'Grant'}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function GrantRow({ prefix, grant }: { prefix: string; grant: Grant }) {
  const client = useWipClient()
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isExpired = grant.expires_at && new Date(grant.expires_at) < new Date()

  const revoke = useMutation({
    mutationFn: async () => {
      const res = await client.registry.revokeGrants(prefix, [{
        subject: grant.subject,
        subject_type: grant.subject_type,
      }])
      const item = res.results[0]
      if (item?.status === 'not_found') throw new Error('Grant not found — it may already be revoked')
      return res
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY(prefix) }),
    onError: (err: Error) => setError(err.message),
  })

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs">
      {SUBJECT_TYPE_ICONS[grant.subject_type]}
      <span className="font-medium text-gray-700">{grant.subject}</span>
      <span className="text-gray-300">·</span>
      <span className="text-gray-400">{grant.subject_type}</span>
      <PermissionBadge permission={grant.permission} />
      {grant.expires_at && (
        <span className={cn('flex items-center gap-1', isExpired ? 'text-danger' : 'text-gray-400')}>
          <Clock size={10} />
          {isExpired ? 'expired' : `until ${new Date(grant.expires_at).toLocaleString()}`}
        </span>
      )}
      <span className="text-gray-300 ml-auto shrink-0">
        by {grant.granted_by} · {new Date(grant.granted_at).toLocaleDateString()}
      </span>
      {error && <span className="text-danger">{error}</span>}
      {confirming ? (
        <span className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => revoke.mutate()}
            disabled={revoke.isPending}
            className="px-2 py-0.5 bg-danger text-white rounded hover:bg-danger disabled:opacity-50"
          >
            {revoke.isPending ? 'Revoking...' : 'Revoke'}
          </button>
          <button
            onClick={() => { setConfirming(false); setError(null) }}
            className="px-2 py-0.5 border border-gray-200 rounded text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="p-1 rounded text-danger/50 hover:text-danger hover:bg-danger/5 shrink-0"
          title="Revoke grant"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Effective per-namespace permissions for an API key.
//
// Runtime keys mirror the registry's _resolve_permission chain: superadmin
// bypass (wip-admins group) → scope ceiling (already applied: we only look at
// the key's own namespaces) → highest non-expired grant matching the key name
// (subject_type=api_key) or one of its groups (subject_type=group) →
// read fallback for in-scope namespaces with no grant.
//
// Config keys never use Registry NamespaceGrants — their grants are declared
// on the deployment and resolve locally in wip-auth, surfaced on the key
// record itself as `grants` (CASE-693).
// ---------------------------------------------------------------------------

function resolveKeyPermission(
  apiKey: APIKeyInfo,
  grants: Grant[],
): { permission: string; source: string } {
  if (apiKey.groups?.includes('wip-admins')) {
    return { permission: 'admin', source: 'superadmin (wip-admins)' }
  }
  const levels: Record<string, number> = { read: 1, write: 2, admin: 3 }
  let best: { permission: string; source: string } | null = null
  for (const g of grants) {
    if (g.expires_at && new Date(g.expires_at) < new Date()) continue
    const matches =
      (g.subject_type === 'api_key' && g.subject === apiKey.name) ||
      (g.subject_type === 'group' && apiKey.groups?.includes(g.subject))
    if (!matches) continue
    if (!best || (levels[g.permission] ?? 0) > (levels[best.permission] ?? 0)) {
      best = {
        permission: g.permission,
        source: g.subject_type === 'group' ? `grant via group "${g.subject}"` : 'direct grant',
      }
    }
  }
  return best ?? { permission: 'read', source: 'in scope, no grant (fallback)' }
}

// Returns null when the connected registry predates the `grants` field —
// in that case the write scope is unknowable here, and saying "read" would
// be wrong for a key that carries config-declared write grants.
function resolveConfigKeyPermission(
  apiKey: APIKeyWithGrants,
  ns: string,
): { permission: string; source: string } | null {
  if (apiKey.groups?.includes('wip-admins')) {
    return { permission: 'admin', source: 'superadmin (wip-admins)' }
  }
  if (apiKey.grants === undefined) return null
  const declared = apiKey.grants?.[ns]
  if (declared) return { permission: declared, source: 'config-declared grant' }
  return { permission: 'read', source: 'in scope, no declared grant' }
}

export function KeyEffectivePermissions({ apiKey }: { apiKey: APIKeyWithGrants }) {
  const client = useWipClient()
  const isConfig = apiKey.source === 'config'
  const namespaces = apiKey.namespaces ?? []
  const results = useQueries({
    queries: namespaces.map(ns => ({
      queryKey: GRANTS_QUERY_KEY(ns),
      queryFn: () => client.registry.listGrants(ns),
      staleTime: 30_000,
      enabled: !isConfig,
    })),
  })

  if (namespaces.length === 0) return null

  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
        <ShieldCheck size={12} />
        Effective permissions
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg divide-y divide-gray-100">
        {namespaces.map((ns, i) => {
          const q = results[i]
          const resolved = isConfig
            ? resolveConfigKeyPermission(apiKey, ns)
            : q?.data ? resolveKeyPermission(apiKey, q.data) : null
          return (
            <div key={ns} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className="font-mono text-gray-600">{ns}</span>
              <span className="ml-auto flex items-center gap-2">
                {!isConfig && q?.isLoading && <span className="text-gray-300">…</span>}
                {!isConfig && q?.error && (
                  <span className="text-gray-300" title={q.error.message}>
                    grants unavailable
                  </span>
                )}
                {isConfig && !resolved && (
                  <span
                    className="text-gray-300"
                    title="This WIP version does not expose config-declared grants (CASE-693). Read them on the install host: config/auth/api-keys.json"
                  >
                    grants not visible for config keys
                  </span>
                )}
                {resolved && (
                  <>
                    <span className="text-gray-400">{resolved.source}</span>
                    <PermissionBadge permission={resolved.permission} />
                  </>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GrantsPanel({ prefix }: { prefix: string }) {
  const [open, setOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const { data: grants, isLoading, error } = useGrants(prefix, open)

  return (
    <details
      className="group"
      open={open}
      onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 flex items-center gap-1.5">
        <ShieldCheck size={12} />
        Grants{grants ? ` (${grants.length})` : ''}
      </summary>
      <div className="mt-2 space-y-2">
        {isLoading && <LoadingState label="Loading grants..." />}
        {error && <ErrorState message={error.message} />}
        {grants && (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {grants.length === 0 ? (
              <p className="text-xs text-gray-400 p-3">
                No grants. Scoped API keys without a grant get read-only access to this namespace.
              </p>
            ) : (
              grants.map(g => (
                <GrantRow key={`${g.subject_type}:${g.subject}`} prefix={prefix} grant={g} />
              ))
            )}
          </div>
        )}
        {showAdd ? (
          <AddGrantForm prefix={prefix} onClose={() => setShowAdd(false)} />
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          >
            <Plus size={12} />
            Add grant
          </button>
        )}
      </div>
    </details>
  )
}
