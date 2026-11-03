import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { APIKeyRevokeResult, NamespaceReservation } from '@wip/client'
import { useReleaseReservation, useReservations } from '@/hooks/use-api-keys'
import { cn } from '@/lib/cn'
import RefreshButton from '@/components/common/RefreshButton'

function ReleaseButton({ prefix, onReleased }: { prefix: string; onReleased?: (prefix: string) => void }) {
  const [error, setError] = useState<string | null>(null)
  const release = useReleaseReservation({
    onSuccess: (p) => { setError(null); onReleased?.(p) },
    onError: (err) => setError(err.message),
  })
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => release.mutate(prefix)}
        disabled={release.isPending}
        aria-label={`Release the reservation of ${prefix}`}
        className="px-2 py-0.5 text-[11px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        {release.isPending ? 'Releasing...' : 'Release'}
      </button>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </span>
  )
}

/** Non-default settings of a reservation, for a compact listing. */
function settingsSummary(settings: Record<string, unknown>): string {
  const parts = Object.entries(settings)
    .filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
      && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0))
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
  return parts.join(' · ')
}

/**
 * Every namespace reservation on the install: from wip-deploy's file (an
 * app it manages) and from runtime API keys. A reservation lets the holder
 * create the namespace with exactly its settings. Runtime ones can be
 * released here; the namespace itself is never touched.
 */
export function ReservationsPanel() {
  const { data, isLoading, isFetching, error, refetch } = useReservations()
  const rows: NamespaceReservation[] = (data ?? []).slice().sort((a, b) => a.prefix.localeCompare(b.prefix))

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-medium text-gray-700">Namespace reservations</h2>
          <p className="text-[11px] text-gray-400">
            A reservation lets its holder create the namespace, with exactly its settings.
          </p>
        </div>
        <RefreshButton
          onRefresh={() => refetch({ cancelRefetch: false })}
          refreshing={isFetching && !isLoading}
          label="Refresh reservations"
          variant="boxed"
          size={12}
          className="p-1.5"
        />
      </div>
      {isLoading && <p className="text-xs text-gray-400 px-4 py-3">Loading reservations...</p>}
      {error && <p className="text-xs text-danger px-4 py-3">{error.message}</p>}
      {data && rows.length === 0 && <p className="text-xs text-gray-400 px-4 py-3">No reservations.</p>}
      {rows.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400">
              <th className="px-4 py-1.5 font-medium">Namespace</th>
              <th className="px-2 py-1.5 font-medium">Held by</th>
              <th className="px-2 py-1.5 font-medium">State</th>
              <th className="px-2 py-1.5 font-medium">Settings</th>
              <th className="px-4 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={`${r.source}:${r.prefix}`}
                data-testid={`reservation-${r.prefix}`}
                className={cn('border-t border-gray-100 align-top', r.conflict && 'bg-danger/5')}
              >
                <td className="px-4 py-1.5 font-mono text-gray-700">{r.prefix}</td>
                <td className="px-2 py-1.5 text-gray-600">
                  {r.source === 'file' ? `app ${r.app} (wip-deploy)` : `key ${r.app}`}
                </td>
                <td className="px-2 py-1.5 text-gray-500">{r.namespace_exists ? 'created' : 'not created yet'}</td>
                <td className="px-2 py-1.5 text-gray-500 font-mono break-all">
                  {settingsSummary(r.settings) || <span className="font-sans text-gray-300">defaults</span>}
                  {r.conflict && (
                    <p className="font-sans text-danger flex items-start gap-1 mt-0.5">
                      <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                      <span>{r.conflict} The namespace can&apos;t be created until one reservation is removed.</span>
                    </p>
                  )}
                </td>
                <td className="px-4 py-1.5 text-right whitespace-nowrap">
                  {r.source === 'runtime'
                    ? <ReleaseButton prefix={r.prefix} />
                    : <span className="text-[11px] text-gray-300">managed by wip-deploy</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** What revoking a key did to its grants and reservations. */
export function RevokeResultBanner({ result, onDismiss }: { result: APIKeyRevokeResult; onDismiss: () => void }) {
  const [released, setReleased] = useState<string[]>([])
  const kept = (result.kept_reservations ?? []).filter(p => !released.includes(p))
  const releasedNow = [...(result.released_reservations ?? []), ...released]
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1.5" role="status">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-700">Revoked API key <strong>{result.name}</strong>.</p>
        <button type="button" onClick={onDismiss} className="text-xs text-gray-400 hover:text-gray-600 underline">
          Dismiss
        </button>
      </div>
      {result.revoked_grants.length > 0 && (
        <p className="text-xs text-gray-500">
          Grants revoked on: <span className="font-mono">{result.revoked_grants.join(', ')}</span>
        </p>
      )}
      {releasedNow.length > 0 && (
        <p className="text-xs text-gray-500">
          Reservations released: <span className="font-mono">{releasedNow.join(', ')}</span>
        </p>
      )}
      {kept.length > 0 && (
        <div className="text-xs text-gray-600 space-y-1">
          <p>
            Reservations kept, because these namespaces exist. They stay until released:
          </p>
          {kept.map(p => (
            <p key={p} className="flex items-center gap-2">
              <span className="font-mono">{p}</span>
              <ReleaseButton prefix={p} onReleased={x => setReleased(prev => [...prev, x])} />
            </p>
          ))}
        </div>
      )}
      <p className="text-[11px] text-gray-400">No namespace is deleted by revoking a key.</p>
    </div>
  )
}
