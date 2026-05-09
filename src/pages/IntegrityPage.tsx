import { useState } from 'react'
import { ShieldCheck, Play, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import StatusBadge from '@/components/common/StatusBadge'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/cn'
import { apiUrl } from '@/lib/wip'

interface IntegrityResult {
  status: string
  checked_at: string
  services_checked: string[]
  summary: {
    total_templates: number
    total_documents: number
    documents_checked: number
    templates_with_issues: number
    documents_with_issues: number
    orphaned_terminology_refs: number
    orphaned_template_refs: number
    orphaned_term_refs: number
    inactive_refs: number
  }
  issues: Array<{
    type: string
    severity: string
    source: string
    entity_id?: string
    field_path?: string
    message?: string
    details?: Record<string, unknown>
  }>
}

export default function IntegrityPage() {
  const [result, setResult] = useState<IntegrityResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/wip/api/reporting-sync/health/integrity'))
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${text}`)
      }
      const data = await res.json() as IntegrityResult
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Integrity check failed')
    } finally {
      setIsLoading(false)
    }
  }

  const statusColor = (s: string) =>
    s === 'healthy' || s === 'ok' ? 'healthy' as const :
    s === 'warning' ? 'warning' as const : 'error' as const

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <ShieldCheck size={24} className="text-primary" />
            Integrity
          </h1>
          <p className="text-sm text-gray-400 mt-1">Cross-service referential integrity checks</p>
        </div>
        <button
          onClick={handleRun}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          {isLoading ? 'Running...' : 'Run Check'}
        </button>
      </div>

      {!result && !isLoading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <ShieldCheck size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Click "Run Check" to verify referential integrity across all services.</p>
          <p className="text-xs text-gray-400 mt-1">Checks: broken term references, missing templates, orphaned documents, inactive references.</p>
        </div>
      )}

      {isLoading && <LoadingState label="Running integrity checks..." />}
      {error && <ErrorState message={error} onRetry={handleRun} />}

      {result && (
        <div className="space-y-4">
          {/* Status banner */}
          <div className={cn(
            'flex items-center gap-3 p-4 rounded-lg border',
            statusColor(result.status) === 'healthy' ? 'bg-success/5 border-success/20' :
            statusColor(result.status) === 'warning' ? 'bg-yellow-50 border-yellow-200' :
            'bg-danger/5 border-danger/20'
          )}>
            {statusColor(result.status) === 'healthy' ? (
              <CheckCircle size={20} className="text-success" />
            ) : statusColor(result.status) === 'warning' ? (
              <AlertTriangle size={20} className="text-yellow-500" />
            ) : (
              <XCircle size={20} className="text-danger" />
            )}
            <div>
              <span className="text-sm font-medium text-gray-800 capitalize">{result.status}</span>
              <p className="text-xs text-gray-500">
                Checked at {new Date(result.checked_at).toLocaleString()}
                {' · '}Services: {result.services_checked.join(', ')}
              </p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Templates', value: result.summary.total_templates, sub: `${result.summary.templates_with_issues} with issues` },
              { label: 'Documents checked', value: result.summary.documents_checked.toLocaleString(), sub: `${result.summary.documents_with_issues} with issues` },
              { label: 'Orphaned term refs', value: result.summary.orphaned_term_refs },
              { label: 'Orphaned terminology refs', value: result.summary.orphaned_terminology_refs },
            ].map((stat) => (
              <div key={stat.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div className="text-lg font-semibold text-gray-800">{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
                {stat.sub && <div className="text-[10px] text-gray-400 mt-0.5">{stat.sub}</div>}
              </div>
            ))}
          </div>

          {/* Issues list */}
          {result.issues.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Issues ({result.issues.length})
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {result.issues.map((issue, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={issue.severity === 'error' ? 'error' : 'warning'}
                        label={issue.severity}
                      />
                      <span className="text-xs text-gray-500 font-mono">{issue.type}</span>
                      <span className="text-xs text-gray-400 ml-auto">{issue.source}</span>
                    </div>
                    {issue.message && (
                      <p className="text-sm text-gray-700 mt-1">{issue.message}</p>
                    )}
                    {issue.entity_id && (
                      <span className="text-xs text-gray-400 font-mono mt-0.5 block">{issue.entity_id}</span>
                    )}
                    {issue.field_path && (
                      <span className="text-xs text-gray-400 mt-0.5 block">Field: {issue.field_path}</span>
                    )}
                    {issue.details && (
                      <details className="mt-1">
                        <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">Details</summary>
                        <pre className="text-[10px] text-gray-500 mt-1 bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(issue.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.issues.length === 0 && (
            <p className="text-sm text-success flex items-center gap-1.5">
              <CheckCircle size={14} />
              No integrity issues found.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
