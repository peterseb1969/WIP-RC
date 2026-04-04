import { useState } from 'react'
import { ShieldCheck, Play, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { useIntegrityCheck } from '@wip/react'
import StatusBadge from '@/components/common/StatusBadge'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/cn'

export default function IntegrityPage() {
  const [runCheck, setRunCheck] = useState(false)
  const { data, isLoading, error, refetch } = useIntegrityCheck(
    runCheck ? { check_term_refs: true } : undefined
  )

  const handleRun = () => {
    setRunCheck(true)
    refetch()
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <ShieldCheck size={24} className="text-blue-500" />
            Integrity
          </h1>
          <p className="text-sm text-gray-400 mt-1">Cross-service referential integrity checks</p>
        </div>
        <button
          onClick={handleRun}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          {isLoading ? 'Running...' : 'Run Check'}
        </button>
      </div>

      {!runCheck && !data && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <ShieldCheck size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Click "Run Check" to verify referential integrity across all services.</p>
          <p className="text-xs text-gray-400 mt-1">Checks: broken term references, missing templates, orphaned documents, inactive references.</p>
        </div>
      )}

      {isLoading && <LoadingState label="Running integrity checks..." />}
      {error && <ErrorState message={error.message} onRetry={handleRun} />}

      {data && (
        <div className="space-y-4">
          {/* Status banner */}
          <div className={cn(
            'flex items-center gap-3 p-4 rounded-lg border',
            data.status === 'healthy' ? 'bg-green-50 border-green-200' :
            data.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
            'bg-red-50 border-red-200'
          )}>
            {data.status === 'healthy' ? (
              <CheckCircle size={20} className="text-green-500" />
            ) : data.status === 'warning' ? (
              <AlertTriangle size={20} className="text-yellow-500" />
            ) : (
              <XCircle size={20} className="text-red-500" />
            )}
            <div>
              <span className="text-sm font-medium text-gray-800 capitalize">{data.status}</span>
              <p className="text-xs text-gray-500">
                {(data.issues ?? []).length === 0
                  ? 'No integrity issues found.'
                  : `${(data.issues ?? []).length} issue${(data.issues ?? []).length !== 1 ? 's' : ''} detected.`
                }
              </p>
            </div>
          </div>

          {/* Issues list */}
          {(data.issues ?? []).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {(data.issues as Array<Record<string, unknown>>).map((issue, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={String(issue.severity) === 'error' ? 'error' : 'warning'}
                      label={String(issue.severity ?? 'warning')}
                    />
                    <span className="text-xs text-gray-400 font-mono">{String(issue.type ?? '')}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{String(issue.message ?? '')}</p>
                  {issue.entity_id && (
                    <span className="text-xs text-gray-400 font-mono mt-0.5 block">{String(issue.entity_id)}</span>
                  )}
                  {issue.field_path && (
                    <span className="text-xs text-gray-400 mt-0.5 block">Field: {String(issue.field_path)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
