import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HardDrive,
} from 'lucide-react'
import { useNamespaces } from '@wip/react'
import StatusBadge from '@/components/common/StatusBadge'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'
import { cn } from '@/lib/cn'
import { apiUrl } from '@/lib/wip'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BackupJob {
  job_id: string
  namespace: string
  type?: 'backup' | 'restore'
  kind?: 'backup' | 'restore'
  status: 'pending' | 'running' | 'complete' | 'failed'
  phase?: string
  percent?: number
  message?: string
  archive_size?: number
  created_at?: string
}

// ---------------------------------------------------------------------------
// Backup Tab
// ---------------------------------------------------------------------------

function BackupTab() {
  const { namespace } = useNamespaceFilter()
  const [includeFiles, setIncludeFiles] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [latestOnly, setLatestOnly] = useState(false)
  const [starting, setStarting] = useState(false)
  const [activeJob, setActiveJob] = useState<BackupJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  const handleStart = async () => {
    if (!namespace) return
    setStarting(true)
    setError(null)
    setActiveJob(null)
    try {
      const res = await fetch(apiUrl(`/wip/api/document-store/backup/namespaces/${namespace}/backup`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_files: includeFiles,
          include_inactive: includeInactive,
          latest_only: latestOnly,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      const job = await res.json() as BackupJob
      setActiveJob(job)
      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(apiUrl(`/wip/api/document-store/backup/jobs/${job.job_id}`))
          if (!r.ok) return
          const updated = await r.json() as BackupJob
          setActiveJob(updated)
          if (updated.status === 'complete' || updated.status === 'failed') stopPolling()
        } catch { /* ignore poll errors */ }
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed')
    } finally {
      setStarting(false)
    }
  }

  const handleDownload = () => {
    if (!activeJob) return
    // Open download URL directly — lets the browser stream the file
    // instead of buffering the entire archive in JS memory.
    // This avoids 502s on large archives (2GB+) and works with any size.
    const a = document.createElement('a')
    a.href = apiUrl(`/wip/api/document-store/backup/jobs/${activeJob.job_id}/download`)
    a.download = `${activeJob.namespace}_backup.zip`
    a.click()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Export a namespace as a .zip archive. Includes terminologies, templates, documents, and optionally files.</p>

      {!namespace && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle size={14} />
          Select a namespace in the top bar first.
        </div>
      )}

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={includeFiles} onChange={e => setIncludeFiles(e.target.checked)} className="rounded border-gray-300" />
          Include file blobs
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} className="rounded border-gray-300" />
          Include inactive/archived entities
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={latestOnly} onChange={e => setLatestOnly(e.target.checked)} className="rounded border-gray-300" />
          Latest versions only
        </label>
      </div>

      <button
        onClick={handleStart}
        disabled={starting || !namespace || (activeJob?.status === 'running')}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {starting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        {starting ? 'Starting...' : `Backup ${namespace || '...'}`}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {activeJob && <JobProgress job={activeJob} onDownload={handleDownload} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Restore Tab
// ---------------------------------------------------------------------------

function RestoreTab() {
  const { namespace } = useNamespaceFilter()
  const { data: namespaces } = useNamespaces()
  const existingPrefixes = new Set((namespaces ?? []).map(ns => ns.prefix))

  const [file, setFile] = useState<File | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [activeJob, setActiveJob] = useState<BackupJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  const handleFileSelect = (f: File | null) => {
    setFile(f)
    setError(null)
    setWarning(null)
    setActiveJob(null)
  }

  const handleRestore = async () => {
    if (!file) return
    setRestoring(true)
    setError(null)
    try {
      if (!namespace) throw new Error('Select a namespace in the top bar first (used for auth check)')

      const formData = new FormData()
      formData.append('archive', file)
      formData.append('mode', 'restore')

      const res = await fetch(apiUrl(`/wip/api/document-store/backup/namespaces/${namespace}/restore`), {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      const job = await res.json() as BackupJob

      // Check if target namespace already exists
      if (job.namespace && existingPrefixes.has(job.namespace)) {
        setWarning(`Namespace "${job.namespace}" already exists. Restore will merge/overwrite existing data.`)
      }

      setActiveJob(job)
      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(apiUrl(`/wip/api/document-store/backup/jobs/${job.job_id}`))
          if (!r.ok) return
          const updated = await r.json() as BackupJob
          setActiveJob(updated)
          if (updated.status === 'complete' || updated.status === 'failed') stopPolling()
        } catch { /* ignore */ }
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Upload a backup archive to restore a namespace. The namespace is determined by the archive — it restores to the original source namespace with original IDs.
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
      >
        <Upload size={24} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">{file ? file.name : 'Click to select a backup archive (.zip)'}</p>
        {file && <p className="text-xs text-gray-400 mt-1">{formatBytes(file.size)}</p>}
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={e => handleFileSelect(e.target.files?.[0] ?? null)}
        />
      </div>

      {warning && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {warning}
        </div>
      )}

      <button
        onClick={handleRestore}
        disabled={restoring || !file || (activeJob?.status === 'running')}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {restoring ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {restoring ? 'Starting...' : 'Restore'}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {activeJob && <JobProgress job={activeJob} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Job Progress
// ---------------------------------------------------------------------------

function JobProgress({ job, onDownload }: { job: BackupJob; onDownload?: () => void }) {
  const statusColor = job.status === 'complete' ? 'text-green-600' : job.status === 'failed' ? 'text-red-600' : 'text-blue-600'
  const StatusIcon = job.status === 'complete' ? CheckCircle : job.status === 'failed' ? XCircle : Loader2

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon size={16} className={cn(statusColor, job.status === 'running' && 'animate-spin')} />
          <span className={cn('text-sm font-medium', statusColor)}>
            {job.status === 'pending' ? 'Queued' : job.status === 'running' ? 'Running' : job.status === 'complete' ? 'Complete' : 'Failed'}
          </span>
          {job.namespace && <span className="text-xs text-gray-400">{job.namespace}</span>}
        </div>
        <span className="text-xs font-mono text-gray-400">{job.job_id}</span>
      </div>

      {job.status === 'running' && job.percent != null && (
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="bg-blue-500 rounded-full h-2 transition-all" style={{ width: `${job.percent}%` }} />
        </div>
      )}

      {job.phase && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500 font-medium">Phase: {job.phase}</span>
          {job.archive_size != null && job.archive_size > 0 && (
            <span className="text-gray-400 flex items-center gap-1"><HardDrive size={10} /> {formatBytes(job.archive_size)}</span>
          )}
        </div>
      )}
      {job.message && <p className="text-xs text-gray-500">{job.message}</p>}
      {!job.phase && job.archive_size != null && <p className="text-xs text-gray-400 flex items-center gap-1"><HardDrive size={10} /> {formatBytes(job.archive_size)}</p>}

      {job.status === 'complete' && onDownload && (
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50"
        >
          <Download size={12} />
          Download Archive
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Jobs List
// ---------------------------------------------------------------------------

function JobsList() {
  const [jobs, setJobs] = useState<BackupJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/wip/api/document-store/backup/jobs?limit=20'))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setJobs(data.jobs ?? data.items ?? data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const handleDelete = async (jobId: string) => {
    try {
      const res = await fetch(apiUrl(`/wip/api/document-store/backup/jobs/${jobId}`), { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setJobs(prev => prev.filter(j => j.job_id !== jobId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Recent Jobs</h3>
        <button onClick={loadJobs} disabled={loading} className="p-1.5 text-gray-400 hover:text-gray-600">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {jobs.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No backup or restore jobs found.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {jobs.map(job => (
            <div key={job.job_id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
              <div className="flex-1 min-w-0">
                <span className={cn('font-medium', (job.kind ?? job.type) === 'backup' ? 'text-blue-600' : 'text-green-600')}>{job.kind ?? job.type ?? 'job'}</span>
                <span className="text-gray-400 ml-2">{job.namespace}</span>
                {job.message && <span className="text-gray-400 ml-2 truncate">{job.message}</span>}
              </div>
              {job.archive_size != null && (
                <span className="text-gray-400 flex items-center gap-1"><HardDrive size={10} />{formatBytes(job.archive_size)}</span>
              )}
              <StatusBadge
                status={job.status === 'complete' ? 'active' : job.status === 'failed' ? 'error' : job.status === 'running' ? 'warning' : 'inactive'}
                label={job.status}
              />
              {job.created_at && <span className="text-gray-300">{new Date(job.created_at).toLocaleDateString()}</span>}
              {job.status === 'complete' && (job.kind ?? job.type) === 'backup' && (
                <a
                  href={apiUrl(`/wip/api/document-store/backup/jobs/${job.job_id}/download`)}
                  download={`${job.namespace}_backup.zip`}
                  className="text-blue-400 hover:text-blue-600"
                  title="Download archive"
                >
                  <Download size={12} />
                </a>
              )}
              {(job.status === 'complete' || job.status === 'failed') && (
                <button onClick={() => handleDelete(job.job_id)} className="text-gray-300 hover:text-red-500" title="Delete job">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Backup & Restore Page
// ---------------------------------------------------------------------------

export default function BackupRestorePage() {
  const [tab, setTab] = useState<'backup' | 'restore'>('backup')

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Backup & Restore</h1>
        <p className="text-sm text-gray-400 mt-1">Export namespaces as archives and restore them.</p>
      </div>

      {/* Tab selector */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('backup')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            tab === 'backup' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="flex items-center gap-1.5"><Download size={14} /> Backup</span>
        </button>
        <button
          onClick={() => setTab('restore')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            tab === 'restore' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="flex items-center gap-1.5"><Upload size={14} /> Restore</span>
        </button>
      </div>

      {/* Tab content */}
      {tab === 'backup' ? <BackupTab /> : <RestoreTab />}

      {/* Jobs list */}
      <JobsList />
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
