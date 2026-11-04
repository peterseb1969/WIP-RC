import { useState } from 'react'
import type { Grant } from '@wip/client'
import { useNamespaces } from '@wip/react'
import RefreshButton from '@/components/common/RefreshButton'
import { PermissionBadge } from '@/components/grants/GrantsPanel'
import { useReservations } from '@/hooks/use-api-keys'
import { ORPHAN_RULE, useActivateGrant, useOrphanedGrants, useRevokeGrant } from '@/hooks/use-orphaned-grants'
import { isManaged, WIP_DEPLOY } from '@/lib/managed-records'

function OrphanRow({ grant, namespaceExists, reservedBy }: {
  grant: Grant
  namespaceExists: boolean
  reservedBy: string | undefined
}) {
  const [error, setError] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const activate = useActivateGrant(err => setError(err.message))
  const revoke = useRevokeGrant(err => setError(err.message))
  const ref = { namespace: grant.namespace, subject: grant.subject, subject_type: grant.subject_type }
  const managed = isManaged(grant)

  return (
    <tr className="border-t border-gray-100 align-top" data-testid={`orphan-${grant.namespace}-${grant.subject}`}>
      <td className="px-4 py-1.5 font-mono text-gray-700">{grant.namespace}</td>
      <td className="px-2 py-1.5 text-gray-700">{grant.subject} <span className="text-gray-400">({grant.subject_type})</span></td>
      <td className="px-2 py-1.5"><PermissionBadge permission={grant.permission} /></td>
      <td className="px-2 py-1.5 text-gray-500">
        {grant.orphaned_at ? new Date(grant.orphaned_at).toLocaleString() : '—'}
      </td>
      <td className="px-2 py-1.5 text-gray-500">
        {namespaceExists
          ? 'exists: activate here'
          : reservedBy
            ? `not created; reserved by ${reservedBy}, whose creating it will not activate this grant`
            : 'not created; activates when a platform admin creates it'}
      </td>
      <td className="px-4 py-1.5 text-right whitespace-nowrap space-x-1">
        {managed ? (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">{WIP_DEPLOY}</span>
        ) : confirmRevoke ? (
          <>
            <button type="button" onClick={() => revoke.mutate(ref)} disabled={revoke.isPending}
              className="px-2 py-0.5 text-[11px] bg-danger text-white rounded disabled:opacity-50">
              {revoke.isPending ? 'Revoking…' : 'Yes, revoke'}
            </button>
            <button type="button" onClick={() => setConfirmRevoke(false)}
              className="px-2 py-0.5 text-[11px] border border-gray-200 rounded text-gray-500">Cancel</button>
          </>
        ) : (
          <>
            {namespaceExists && (
              <button type="button" onClick={() => { setError(null); activate.mutate(ref) }} disabled={activate.isPending}
                aria-label={`Activate ${grant.subject} on ${grant.namespace}`}
                className="px-2 py-0.5 text-[11px] border border-primary/30 text-primary rounded hover:bg-primary/5 disabled:opacity-50">
                {activate.isPending ? 'Activating…' : 'Activate'}
              </button>
            )}
            <button type="button" onClick={() => { setError(null); setConfirmRevoke(true) }}
              aria-label={`Revoke ${grant.subject} on ${grant.namespace}`}
              className="px-2 py-0.5 text-[11px] border border-gray-200 rounded text-danger/70 hover:text-danger hover:bg-danger/5">
              Revoke
            </button>
          </>
        )}
        {error && <p className="text-[11px] text-danger whitespace-normal text-left mt-1" role="alert">{error}</p>}
      </td>
    </tr>
  )
}

/** Every orphaned grant on the stack, with where each stands and what activates it. */
export default function OrphanedGrantsPanel() {
  const { data: orphans, isLoading, isFetching, error, refetch } = useOrphanedGrants()
  const { data: namespaces } = useNamespaces()
  const { data: reservations } = useReservations()
  const existing = new Set((namespaces ?? []).map(n => n.prefix))
  const reservedBy = new Map((reservations ?? []).map(r => [r.prefix, r.source === 'file' || isManaged(r) ? `app ${r.app}` : `key ${r.app}`]))
  const rows = (orphans ?? []).slice().sort((a, b) => a.namespace.localeCompare(b.namespace) || a.subject.localeCompare(b.subject))

  return (
    <div className="bg-white border border-gray-200 rounded-lg" data-testid="orphaned-grants">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 gap-4">
        <div>
          <h2 className="text-sm font-medium text-gray-700">Orphaned grants</h2>
          <p className="text-[11px] text-gray-400">{ORPHAN_RULE}</p>
        </div>
        <RefreshButton onRefresh={() => refetch({ cancelRefetch: false })} refreshing={isFetching && !isLoading}
          label="Refresh orphaned grants" variant="boxed" size={12} className="p-1.5 shrink-0" />
      </div>
      {isLoading && <p className="text-xs text-gray-400 px-4 py-3">Loading orphaned grants…</p>}
      {error && <p className="text-xs text-danger px-4 py-3">{error.message}</p>}
      {orphans && rows.length === 0 && <p className="text-xs text-gray-400 px-4 py-3">No orphaned grants.</p>}
      {rows.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400">
              <th className="px-4 py-1.5 font-medium">Namespace</th>
              <th className="px-2 py-1.5 font-medium">Subject</th>
              <th className="px-2 py-1.5 font-medium">Permission</th>
              <th className="px-2 py-1.5 font-medium">Orphaned</th>
              <th className="px-2 py-1.5 font-medium">Namespace state</th>
              <th className="px-4 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map(g => (
              <OrphanRow key={`${g.namespace}:${g.subject_type}:${g.subject}`} grant={g}
                namespaceExists={existing.has(g.namespace)} reservedBy={reservedBy.get(g.namespace)} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
