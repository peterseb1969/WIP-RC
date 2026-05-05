import { useState } from 'react'
import {
  PlayCircle,
  RotateCw,
  CheckCircle,
  XCircle,
  Clock,
  X,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import {
  useBatchJobs,
  useTemplates,
  useNamespaces,
  useTriggerBatchSyncAll,
  useTriggerBatchSync,
  useTriggerTerminologySync,
  useTriggerTermSync,
  useTriggerTermRelationSync,
  useCancelBatchJob,
  useClearCompletedJobs,
} from '@wip/react'
import type { BatchSyncJob, BatchSyncStatus } from '@wip/client'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// BatchSyncPanel — admin surface for reporting-sync's batch endpoints.
// CASE-283. Two sections:
//   1. Trigger controls (all templates / single template / per-namespace
//      entity tables: terminologies, terms, term-relations).
//   2. Live job list (auto-polled while anything is running, otherwise idle).
// Sync-status card is rendered above this panel by PostgresPage.
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = new Set<BatchSyncStatus>(['pending', 'running'])

export default function BatchSyncPanel() {
  const { data: templates } = useTemplates({ status: 'active', latest_only: true, page_size: 200 })
  const { data: namespaces } = useNamespaces()

  const [singleTemplate, setSingleTemplate] = useState('')
  const [entityNs, setEntityNs] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [force, setForce] = useState(false)
  const [pageSize, setPageSize] = useState(100)
  const [error, setError] = useState<string | null>(null)

  // Live job list — poll fast while anything is running, slow otherwise.
  const jobsQ = useBatchJobs()
  const jobs = jobsQ.data ?? []
  const hasActive = jobs.some(j => ACTIVE_STATUSES.has(j.status))
  const liveJobsQ = useBatchJobs({ refetchInterval: hasActive ? 3000 : 30_000 })
  const liveJobs = liveJobsQ.data ?? jobs

  const triggerAll = useTriggerBatchSyncAll({ onError: e => setError(e.message) })
  const triggerOne = useTriggerBatchSync({ onError: e => setError(e.message) })
  const triggerTerminologies = useTriggerTerminologySync({ onError: e => setError(e.message) })
  const triggerTerms = useTriggerTermSync({ onError: e => setError(e.message) })
  const triggerRelations = useTriggerTermRelationSync({ onError: e => setError(e.message) })
  const clearCompleted = useClearCompletedJobs({ onError: e => setError(e.message) })

  const handleSyncAll = () => {
    setError(null)
    triggerAll.mutate({ force, page_size: pageSize })
  }
  const handleSyncOne = () => {
    setError(null)
    if (!singleTemplate) { setError('Pick a template to sync'); return }
    triggerOne.mutate({ template_value: singleTemplate, force, page_size: pageSize })
  }
  const handleEntitySync = (kind: 'terminologies' | 'terms' | 'term_relations') => {
    setError(null)
    if (!entityNs) { setError('Pick a namespace for entity sync'); return }
    const vars = { namespace: entityNs, pageSize }
    if (kind === 'terminologies') triggerTerminologies.mutate(vars)
    else if (kind === 'terms') triggerTerms.mutate(vars)
    else triggerRelations.mutate(vars)
  }

  const anyTriggerPending =
    triggerAll.isPending ||
    triggerOne.isPending ||
    triggerTerminologies.isPending ||
    triggerTerms.isPending ||
    triggerRelations.isPending

  const completedCount = liveJobs.filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled').length

  return (
    <div className="space-y-4">
      {/* Trigger controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Trigger batch sync</h3>

        {/* Templates */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-500">Templates</label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSyncAll}
              disabled={anyTriggerPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {triggerAll.isPending ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={14} />}
              Sync all templates
            </button>
            <span className="text-xs text-gray-400">or</span>
            <select
              value={singleTemplate}
              onChange={e => setSingleTemplate(e.target.value)}
              className="border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            >
              <option value="">Single template…</option>
              {(templates?.items ?? []).map(t => (
                <option key={t.template_id} value={t.value}>{t.label || t.value}</option>
              ))}
            </select>
            <button
              onClick={handleSyncOne}
              disabled={anyTriggerPending || !singleTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {triggerOne.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
              Sync this template
            </button>
          </div>
        </div>

        {/* Entity tables (per namespace) */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-500">Entity tables (per namespace)</label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={entityNs}
              onChange={e => setEntityNs(e.target.value)}
              className="border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            >
              <option value="">Namespace…</option>
              {(namespaces ?? []).map(n => (
                <option key={n.prefix} value={n.prefix}>{n.prefix}</option>
              ))}
            </select>
            <button
              onClick={() => handleEntitySync('terminologies')}
              disabled={anyTriggerPending || !entityNs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {triggerTerminologies.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
              Terminologies
            </button>
            <button
              onClick={() => handleEntitySync('terms')}
              disabled={anyTriggerPending || !entityNs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {triggerTerms.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
              Terms
            </button>
            <button
              onClick={() => handleEntitySync('term_relations')}
              disabled={anyTriggerPending || !entityNs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {triggerRelations.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
              Term-Relations
            </button>
          </div>
        </div>

        {/* Advanced */}
        <div>
          <button
            type="button"
            onClick={() => setAdvanced(a => !a)}
            className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
          >
            {advanced ? 'Hide advanced' : 'Advanced…'}
          </button>
          {advanced && (
            <div className="mt-2 flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
                <span className="text-gray-600">Force (re-sync already-synced docs)</span>
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-gray-600">Page size</span>
                <input
                  type="number"
                  value={pageSize}
                  onChange={e => setPageSize(Math.max(1, Number(e.target.value) || 100))}
                  min={1}
                  max={1000}
                  className="w-20 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </label>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Jobs list */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">
            Jobs
            <span className="ml-2 text-xs text-gray-400">
              {liveJobs.length} total{hasActive ? ' · polling' : ''}
            </span>
          </h3>
          {completedCount > 0 && (
            <button
              onClick={() => clearCompleted.mutate()}
              disabled={clearCompleted.isPending}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              title="Remove completed/failed/cancelled jobs from the list"
            >
              <Trash2 size={10} />
              Clear completed ({completedCount})
            </button>
          )}
        </div>
        {liveJobs.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 py-6 text-center">
            No jobs yet. Trigger a batch sync above.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {liveJobs.map(j => (
              <JobRow key={j.job_id} job={j} />
            ))}
          </div>
        )}
        <p className="text-[11px] text-gray-400 px-4 py-2 border-t border-gray-100">
          Job state is in-memory in reporting-sync. Restarting the service drops all history.
        </p>
      </div>
    </div>
  )
}

function JobRow({ job }: { job: BatchSyncJob }) {
  const cancel = useCancelBatchJob()
  const isActive = ACTIVE_STATUSES.has(job.status)
  const pct =
    job.total_documents > 0
      ? Math.min(100, Math.round((job.documents_synced / job.total_documents) * 100))
      : null

  return (
    <div className="px-4 py-2.5 flex items-center gap-3 text-xs">
      <StatusIcon status={job.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-gray-700">{job.template_value}</span>
          <span className="text-gray-400">{job.status}</span>
          {pct !== null && (
            <span className="text-gray-500">
              {pct}% ({job.documents_synced.toLocaleString()}/{job.total_documents.toLocaleString()})
            </span>
          )}
          {job.documents_failed > 0 && (
            <span className="text-amber-600">{job.documents_failed} failed</span>
          )}
        </div>
        {pct !== null && isActive && (
          <div className="mt-1 h-1 bg-gray-100 rounded overflow-hidden">
            <div
              className={cn('h-full transition-all', job.status === 'failed' ? 'bg-red-400' : 'bg-blue-400')}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {job.error_message && (
          <div className="mt-1 text-red-600 break-words">{job.error_message}</div>
        )}
        <div className="mt-0.5 text-[10px] text-gray-400 flex items-center gap-2">
          <span className="font-mono">{job.job_id.slice(0, 8)}</span>
          {job.started_at && (
            <span className="inline-flex items-center gap-0.5">
              <Clock size={9} />
              started {new Date(job.started_at).toLocaleTimeString()}
            </span>
          )}
          {job.completed_at && (
            <span>· finished {new Date(job.completed_at).toLocaleTimeString()}</span>
          )}
          {job.current_page > 0 && isActive && (
            <span>· page {job.current_page}</span>
          )}
        </div>
      </div>
      {isActive && (
        <button
          onClick={() => cancel.mutate(job.job_id)}
          disabled={cancel.isPending}
          className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
          title="Cancel job"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: BatchSyncStatus }) {
  switch (status) {
    case 'completed': return <CheckCircle size={14} className="text-green-500 shrink-0" />
    case 'failed':    return <XCircle size={14} className="text-red-500 shrink-0" />
    case 'cancelled': return <X size={14} className="text-gray-400 shrink-0" />
    case 'running':   return <Loader2 size={14} className="text-blue-500 shrink-0 animate-spin" />
    case 'pending':   return <Clock size={14} className="text-amber-500 shrink-0" />
  }
}
