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
  completed_at?: string
}

// Build a human-useful archive filename: <namespace>_<YYYY-MM-DD_HHMMSS>.zip
// (e.g. clintrial_2026-05-23_191405.zip). Timestamp prefers the job's
// completion time, falling back to creation time. Both the server's
// Content-Disposition header and the anchor's download attribute use this —
// the server header wins in browsers, so they must agree.
function archiveFilename(job: Pick<BackupJob, 'namespace' | 'completed_at' | 'created_at'>): string {
  const iso = (job.completed_at || job.created_at || '').slice(0, 19) // YYYY-MM-DDTHH:MM:SS
  const stamp = iso ? iso.replace('T', '_').replace(/:/g, '') : 'unknown'
  const ns = (job.namespace || 'wip').replace(/[^A-Za-z0-9_-]/g, '_')
  return `${ns}_${stamp}.zip`
}

// ---------------------------------------------------------------------------
// Backup Tab
// ---------------------------------------------------------------------------

function BackupTab() {
  const { namespace: globalNs } = useNamespaceFilter()
  const { data: namespaces } = useNamespaces()
  // Default the selection to the current top-bar namespace (if any); the user
  // can add more. Backup fans out one single-namespace job per selected
  // namespace — the backend is single-namespace per archive (see CASE-542 for
  // the combined-archive work), so N selections produce N independent archives.
  const [selected, setSelected] = useState<string[]>(globalNs ? [globalNs] : [])
  const [includeFiles, setIncludeFiles] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [latestOnly, setLatestOnly] = useState(false)
  const [starting, setStarting] = useState(false)
  const [activeJobs, setActiveJobs] = useState<BackupJob[]>([])
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Mirror the latest jobs into a ref so the poll interval reads current state
  // without being re-created each tick.
  const jobsRef = useRef<BackupJob[]>([])
  jobsRef.current = activeJobs

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  const isTerminal = (s: BackupJob['status']) => s === 'complete' || s === 'failed'

  const startPolling = useCallback(() => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      const pending = jobsRef.current.filter(j => !isTerminal(j.status) && !j.job_id.startsWith('err-'))
      if (pending.length === 0) { stopPolling(); return }
      const updates = await Promise.all(pending.map(async j => {
        try {
          const r = await fetch(apiUrl(`/wip/api/document-store/backup/jobs/${j.job_id}`))
          if (!r.ok) return null
          return await r.json() as BackupJob
        } catch { return null }
      }))
      setActiveJobs(prev => prev.map(j => updates.find(u => u?.job_id === j.job_id) ?? j))
    }, 2000)
  }, [])

  const handleStart = async () => {
    if (selected.length === 0) return
    setStarting(true)
    setError(null)
    setActiveJobs([])
    try {
      const started = await Promise.all(selected.map(async ns => {
        try {
          const res = await fetch(apiUrl(`/wip/api/document-store/backup/namespaces/${ns}/backup`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              include_files: includeFiles,
              include_inactive: includeInactive,
              latest_only: latestOnly,
            }),
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
          return await res.json() as BackupJob
        } catch (e) {
          // Surface a per-namespace start failure as a failed pseudo-job rather
          // than aborting the whole fan-out — other namespaces still proceed.
          return {
            job_id: `err-${ns}`,
            namespace: ns,
            kind: 'backup',
            status: 'failed',
            message: e instanceof Error ? e.message : 'Failed to start',
          } as BackupJob
        }
      }))
      setActiveJobs(started)
      startPolling()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed')
    } finally {
      setStarting(false)
    }
  }

  const downloadJob = (job: BackupJob) => {
    // Open download URL directly — lets the browser stream the file instead of
    // buffering the entire archive in JS memory. Avoids 502s on large archives.
    const fname = archiveFilename(job)
    const a = document.createElement('a')
    a.href = apiUrl(`/api/backup-download/${job.job_id}?filename=${encodeURIComponent(fname)}`)
    a.download = fname
    a.click()
  }

  const anyRunning = activeJobs.some(j => !isTerminal(j.status) && !j.job_id.startsWith('err-'))

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Export one or more namespaces as .zip archives. Each namespace produces its own archive — select several to back them up in one go. Includes terminologies, templates, documents, and optionally files.</p>

      <NamespaceMultiSelect
        namespaces={(namespaces ?? []).map(n => ({ prefix: n.prefix }))}
        selected={selected}
        onChange={setSelected}
      />

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
        disabled={starting || selected.length === 0 || anyRunning}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
      >
        {starting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        {starting
          ? 'Starting...'
          : selected.length === 0
            ? 'Select namespaces to back up'
            : `Backup ${selected.length} namespace${selected.length === 1 ? '' : 's'}`}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {activeJobs.length > 0 && (
        <div className="space-y-2">
          {activeJobs.map(job => (
            <JobProgress key={job.job_id} job={job} onDownload={() => downloadJob(job)} />
          ))}
        </div>
      )}
    </div>
  )
}

// Compact checkbox list for picking one-or-more namespaces to back up.
function NamespaceMultiSelect({
  namespaces,
  selected,
  onChange,
}: {
  namespaces: Array<{ prefix: string }>
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const allPrefixes = namespaces.map(n => n.prefix)
  const allSelected = allPrefixes.length > 0 && allPrefixes.every(p => selected.includes(p))
  const toggle = (p: string) =>
    onChange(selected.includes(p) ? selected.filter(x => x !== p) : [...selected, p])
  const toggleAll = () => onChange(allSelected ? [] : allPrefixes)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-600">Namespaces to back up</label>
        {allPrefixes.length > 0 && (
          <button type="button" onClick={toggleAll} className="text-[11px] text-primary hover:underline">
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        )}
      </div>
      {allPrefixes.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No namespaces available.</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-gray-100 rounded p-2 bg-gray-50/50">
          {namespaces.map(n => (
            <label
              key={n.prefix}
              className={cn(
                'flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer hover:bg-white',
                selected.includes(n.prefix) && 'bg-white',
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(n.prefix)}
                onChange={() => toggle(n.prefix)}
                className="rounded border-gray-300"
              />
              <span className="font-mono text-gray-700 truncate">{n.prefix}</span>
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <p className="text-[11px] text-gray-500 mt-1">{selected.length} selected</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Restore Tab
// ---------------------------------------------------------------------------

function RestoreTab() {
  const { data: namespaces } = useNamespaces()

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
    setWarning(null)
    try {
      const formData = new FormData()
      formData.append('archive', file)
      formData.append('mode', 'restore')

      const res = await fetch(apiUrl('/api/backup-restore'), {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      const job = await res.json() as BackupJob

      // Inform user which namespace the archive will restore into
      const existingPrefixes = new Set((namespaces ?? []).map(ns => ns.prefix))
      if (job.namespace) {
        if (existingPrefixes.has(job.namespace)) {
          setWarning(`Restoring into existing namespace "${job.namespace}" — data will be merged/overwritten.`)
        } else {
          setWarning(`Restoring into new namespace "${job.namespace}".`)
        }
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
        Upload a backup archive to restore a namespace. The target namespace is read from the archive automatically. Restore preserves original IDs.
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
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
      >
        {restoring ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {restoring ? 'Starting...' : 'Restore'}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
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
  const statusColor = job.status === 'complete' ? 'text-success' : job.status === 'failed' ? 'text-danger' : 'text-primary'
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
          <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${job.percent}%` }} />
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary border border-primary/20 rounded-md hover:bg-primary/5"
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

      {error && <p className="text-xs text-danger">{error}</p>}

      {jobs.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No backup or restore jobs found.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {jobs.map(job => (
            <div key={job.job_id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
              <div className="flex-1 min-w-0">
                <span className={cn('font-medium', (job.kind ?? job.type) === 'backup' ? 'text-primary' : 'text-success')}>{job.kind ?? job.type ?? 'job'}</span>
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
              {/* Download is a repeatable GET against the job's retained
                  archive. The backend (document-store backup.py:415) refuses
                  download for any job whose kind !== 'backup' (400), even
                  though restore-upload archives sit on disk too — so we can
                  only offer it for backup jobs until that guard is relaxed. */}
              {job.status === 'complete' && (job.kind ?? job.type) === 'backup' && (
                <a
                  href={apiUrl(`/api/backup-download/${job.job_id}?filename=${encodeURIComponent(archiveFilename(job))}`)}
                  download={archiveFilename(job)}
                  className="text-primary-light hover:text-primary"
                  title="Download archive"
                >
                  <Download size={12} />
                </a>
              )}
              {(job.status === 'complete' || job.status === 'failed') && (
                <button onClick={() => handleDelete(job.job_id)} className="text-gray-300 hover:text-danger" title="Delete job">
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
            tab === 'backup' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="flex items-center gap-1.5"><Download size={14} /> Backup</span>
        </button>
        <button
          onClick={() => setTab('restore')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            tab === 'restore' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
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
