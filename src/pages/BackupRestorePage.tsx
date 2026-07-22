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
  Eye,
  ShieldCheck,
} from 'lucide-react'
import { useNamespaces } from '@wip/react'
import type {
  BackupJobKind,
  ClashPolicy,
  NamespaceIntegrityResult,
  RestoreMode,
} from '@wip/client'
import StatusBadge from '@/components/common/StatusBadge'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'
import { cn } from '@/lib/cn'
import { apiUrl } from '@/lib/wip'
import {
  readArchiveManifest,
  isUnsupportedArchiveVersion,
  type ArchiveManifest,
} from '@/lib/archive-version'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BackupJob {
  job_id: string
  namespace: string
  // CASE-542: a combined-archive job spans several namespaces; `namespace` is
  // the anchor, `namespaces` the full set. Single-namespace jobs omit it or
  // carry a 1-element list.
  namespaces?: string[]
  type?: BackupJobKind
  kind?: BackupJobKind
  status: 'pending' | 'running' | 'complete' | 'failed'
  phase?: string
  percent?: number
  message?: string
  archive_size?: number
  created_at?: string
  completed_at?: string
  /** Non-fatal notes the job recorded. */
  warnings?: string[]
  /** Present on `validate` jobs once complete. */
  result?: NamespaceIntegrityResult | null
  /**
   * Validation jobs a completed restore started, one per namespace it wrote.
   * The restore does not wait for them — its data is committed either way.
   */
  validation_job_ids?: string[]
}

// Build a human-useful archive filename: <namespaces>_<YYYY-MM-DD_HHMMSS>.zip
// (e.g. clintrial_2026-05-23_191405.zip, or kb_library_… for a combined
// archive). Timestamp prefers the job's completion time, falling back to
// creation time. Both the server's Content-Disposition header and the anchor's
// download attribute use this — the server header wins in browsers, so they
// must agree.
export function archiveFilename(job: Pick<BackupJob, 'namespace' | 'namespaces' | 'completed_at' | 'created_at'>): string {
  const iso = (job.completed_at || job.created_at || '').slice(0, 19) // YYYY-MM-DDTHH:MM:SS
  const stamp = iso ? iso.replace('T', '_').replace(/:/g, '') : 'unknown'
  const names = job.namespaces && job.namespaces.length > 0
    ? job.namespaces
    : [job.namespace || 'wip']
  // Namespace prefixes are lowercase [a-z0-9-], so `_` cleanly separates them.
  // Anything unexpected collapses to `_`; the server download route keeps `_`.
  const ns = joinNamespacesForFilename(names).replace(/[^A-Za-z0-9_-]/g, '_')
  return `${ns}_${stamp}.zip`
}

// List every namespace a combined archive contains (Peter's request), kept
// bounded so a whole-instance backup doesn't yield a 300-char filename: list
// them all while they fit, otherwise name the leading ones and count the rest.
function joinNamespacesForFilename(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'wip'
  const joined = names.join('_')
  if (joined.length <= 72) return joined
  const kept: string[] = []
  let len = 0
  for (const n of names) {
    if (len + n.length + 1 > 60) break
    kept.push(n)
    len += n.length + 1
  }
  return `${kept.join('_')}_and_${names.length - kept.length}_more`
}

// Extract a clean message from a non-ok response: prefer the backend's JSON
// `detail`/`error`/`message`, fall back to raw text. Keeps API errors (e.g.
// CASE-552's "Archive is format v2.0 — convert it first") readable instead of
// dumping `HTTP 400: {"detail":...}`.
async function readError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const j = JSON.parse(text)
    return j.detail || j.error || j.message || text || `HTTP ${res.status}`
  } catch {
    return text || `HTTP ${res.status}`
  }
}

// A multi-namespace restore has no single target — the backend uses '_' as
// the URL anchor and restores each namespace in the archive into itself.
const PLACEHOLDER_NS = new Set(['_', '-', ''])

// Restore uploads go straight through the shared proxy now that @wip/proxy
// 0.5.0 streams the request body (CASE-753) — the bespoke server route that
// used to buffer this upload was retired. `_` is the placeholder anchor: the
// backend reads the real target(s) from the archive (or from the options we
// attach), so the URL namespace is only there to satisfy routing + auth.
const RESTORE_URL = '/wip/api/document-store/backup/namespaces/_/restore'

// Human label for the namespace(s) a job touches. Prefers the explicit
// `namespaces` list (combined backups, and restores once the backend
// populates it); falls back to the single `namespace`, and never shows the
// bare '_' placeholder.
function jobNamespaceLabel(job: Pick<BackupJob, 'namespace' | 'namespaces'>): string {
  if (job.namespaces && job.namespaces.length > 1) return `${job.namespaces.length} namespaces`
  if (job.namespaces && job.namespaces.length === 1) return job.namespaces[0]!
  if (job.namespace && !PLACEHOLDER_NS.has(job.namespace)) return job.namespace
  return 'multiple namespaces'
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
  // CASE-542: combine the selected namespaces into ONE archive (a single
  // job spanning them) instead of fanning out to one archive per namespace.
  const [combine, setCombine] = useState(false)
  // Back up every namespace the registry lists into one archive. Overrides the
  // explicit selection server-side, so the picker is disabled while it is on.
  const [allNamespaces, setAllNamespaces] = useState(false)
  const [includeFiles, setIncludeFiles] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  // Definitions-only archive: terminologies, terms, templates, no documents.
  const [skipDocuments, setSkipDocuments] = useState(false)
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

  // Options every start shares. Deliberately NOT sent: latest_only, dry_run,
  // skip_closure, skip_synonyms and template_prefixes — all belonged to the
  // retired toolkit export path and the backup engine now 400s on them rather
  // than silently producing an archive that differs from what was asked for.
  const baseOptions = () => ({
    include_files: includeFiles,
    include_inactive: includeInactive,
    skip_documents: skipDocuments,
  })

  const startBackupJob = async (anchor: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(apiUrl(`/wip/api/document-store/backup/namespaces/${anchor}/backup`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseOptions(), ...extra }),
    })
    if (!res.ok) throw new Error(await readError(res))
    return await res.json() as BackupJob
  }

  const startCombined = async () => {
    // One job spanning all selected namespaces → one archive (CASE-542 v3).
    // The URL anchor is the first selection; the rest go in the body, where
    // the backend merges + dedups them with the anchor.
    const [anchor, ...rest] = selected
    return startBackupJob(anchor!, { namespaces: rest })
  }

  const handleStart = async () => {
    if (!allNamespaces && selected.length === 0) return
    setStarting(true)
    setError(null)
    setActiveJobs([])

    // Whole-instance mode: the backend resolves every registry namespace, so
    // the URL anchor is only there to satisfy the route (and to authorise —
    // admin is still required on every namespace in the resolved set).
    if (allNamespaces) {
      try {
        const anchor = selected[0] || globalNs || namespaces?.[0]?.prefix
        if (!anchor) { setError('No namespaces available to anchor the backup'); setStarting(false); return }
        const job = await startBackupJob(anchor, { all_namespaces: true })
        setActiveJobs([job])
        startPolling()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Backup failed')
      } finally {
        setStarting(false)
      }
      return
    }

    // Combined mode: a single job for all selected namespaces.
    if (combine && selected.length > 1) {
      try {
        const job = await startCombined()
        setActiveJobs([job])
        startPolling()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Combined backup failed')
      } finally {
        setStarting(false)
      }
      return
    }

    // Separate mode (or a single selection): one job per namespace.
    try {
      const started = await Promise.all(selected.map(async ns => {
        try {
          return await startBackupJob(ns)
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
      <p className="text-sm text-gray-500">Export one or more namespaces as .zip archives. Select several to back them up in one go — as separate archives, or combined into a single archive. Includes terminologies, templates, documents, and optionally files.</p>

      {/* Whole-instance archive. Overrides the explicit selection server-side,
          so the picker below is disabled rather than silently ignored. */}
      <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={allNamespaces}
          onChange={e => setAllNamespaces(e.target.checked)}
          className="rounded border-gray-300 mt-0.5"
        />
        <span>
          Every namespace in the registry
          <span className="block text-[11px] text-gray-400">
            One archive covering the whole instance (including <code className="font-mono">wip</code>). Requires admin on every namespace.
          </span>
        </span>
      </label>

      <div className={cn(allNamespaces && 'opacity-40 pointer-events-none')} aria-disabled={allNamespaces}>
        <NamespaceMultiSelect
          namespaces={(namespaces ?? []).map(n => ({ prefix: n.prefix }))}
          selected={selected}
          onChange={setSelected}
        />

        {/* CASE-542 — combine selected namespaces into one archive. Only
            meaningful with 2+ selected; otherwise a single namespace is one
            archive either way. */}
        <label className={cn(
          'flex items-start gap-2 text-sm cursor-pointer mt-4',
          selected.length < 2 ? 'text-gray-400' : 'text-gray-700',
        )}>
          <input
            type="checkbox"
            checked={combine}
            onChange={e => setCombine(e.target.checked)}
            disabled={selected.length < 2}
            className="rounded border-gray-300 mt-0.5"
          />
          <span>
            Combine into a single archive
            <span className="block text-[11px] text-gray-400">
              One job spanning all selected namespaces (restores them together). Off = one archive per namespace.
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={includeFiles} onChange={e => setIncludeFiles(e.target.checked)} className="rounded border-gray-300" />
          Include file blobs
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} className="rounded border-gray-300" />
          Include inactive/archived entities
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={skipDocuments} onChange={e => setSkipDocuments(e.target.checked)} className="rounded border-gray-300 mt-0.5" />
          <span>
            Definitions only (skip documents)
            <span className="block text-[11px] text-gray-400">
              Terminologies, terms and templates without the document corpus — useful for seeding a new namespace.
            </span>
          </span>
        </label>
      </div>

      <button
        onClick={handleStart}
        disabled={starting || (!allNamespaces && selected.length === 0) || anyRunning}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
      >
        {starting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        {starting
          ? 'Starting...'
          : allNamespaces
            ? 'Backup every namespace → 1 archive'
            : selected.length === 0
              ? 'Select namespaces to back up'
              : combine && selected.length > 1
                ? `Backup ${selected.length} namespaces → 1 archive`
                : `Backup ${selected.length} namespace${selected.length === 1 ? '' : 's'}${selected.length > 1 ? ` → ${selected.length} archives` : ''}`}
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
  const [manifest, setManifest] = useState<ArchiveManifest | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [activeJob, setActiveJob] = useState<BackupJob | null>(null)
  const [previewJob, setPreviewJob] = useState<BackupJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  // Set when the selected archive is positively detected as a non-v3 format —
  // blocks the upload locally with a clear message (CASE-552 also guards the
  // backend). Unknown/v3 archives leave this null (fail open).
  const [unsupported, setUnsupported] = useState(false)

  // --- Restore options -----------------------------------------------------
  const [mode, setMode] = useState<RestoreMode>('restore')
  // fresh (single-namespace archive) target, and merge's optional rename.
  const [targetNamespace, setTargetNamespace] = useState('')
  // fresh (multi-namespace archive): {source -> target}, one entry per source.
  const [nsMap, setNsMap] = useState<Record<string, string>>({})
  const [onClash, setOnClash] = useState<ClashPolicy>('skip')
  const [addMissing, setAddMissing] = useState(false)
  const [extendTerminologies, setExtendTerminologies] = useState(false)
  const [skipDocuments, setSkipDocuments] = useState(false)
  const [skipFiles, setSkipFiles] = useState(false)
  const [batchSize, setBatchSize] = useState(500)
  const [dropStaleReporting, setDropStaleReporting] = useState(false)
  const [advanced, setAdvanced] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const existingPrefixes = new Set((namespaces ?? []).map(ns => ns.prefix))
  const sources = manifest?.namespaces.map(n => n.prefix) ?? []
  // A fresh restore of a multi-namespace archive needs namespace_map; a
  // single-namespace one takes the target_namespace shorthand. When the
  // manifest could not be read we cannot tell, so fall back to the shorthand
  // and let the backend refuse if it needs the map.
  const isMultiArchive = sources.length > 1

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }
  const stopPreviewPolling = () => {
    if (previewPollRef.current) { clearInterval(previewPollRef.current); previewPollRef.current = null }
  }

  useEffect(() => () => { stopPolling(); stopPreviewPolling() }, [])

  const handleFileSelect = async (f: File | null) => {
    setFile(f)
    setError(null)
    setWarning(null)
    setActiveJob(null)
    setPreviewJob(null)
    setUnsupported(false)
    setManifest(null)
    setNsMap({})
    setTargetNamespace('')
    if (!f) return
    // Peek the manifest client-side: the format_version catches an accidental
    // v2 upload instantly (it would otherwise create an empty namespace and
    // silently restore nothing — CASE-552), and the namespace list is what the
    // fresh-restore mapping inputs are built from.
    const m = await readArchiveManifest(f)
    setManifest(m)
    if (isUnsupportedArchiveVersion(m?.format_version ?? null)) {
      setUnsupported(true)
      setError(`This is a v${m?.format_version} archive — restore only supports v3. Convert it first:  python -m wip_toolkit.convert_archive OLD.zip NEW.zip`)
      return
    }
    // Seed the mapping with identity so the inputs start from something
    // meaningful; targets that collide with a live namespace are flagged
    // inline, because 'fresh' only allows a same-name target when that
    // namespace is absent.
    const prefixes = m?.namespaces.map(n => n.prefix) ?? []
    if (prefixes.length > 1) setNsMap(Object.fromEntries(prefixes.map(p => [p, p])))
    else if (prefixes.length === 1) setTargetNamespace(prefixes[0]!)
  }

  /**
   * The form both the dry run and the real run submit. A preview is only
   * worth anything if it previews the SAME options, so this is shared —
   * `dry_run` is the single difference.
   *
   * Fields are sent only where they apply: the backend rejects `namespace_map`
   * outside 'fresh' and `drop_stale_reporting` on a merge, so sending them
   * unconditionally would turn valid UI states into 400s.
   */
  const buildForm = (dryRun: boolean): FormData => {
    const fd = new FormData()
    fd.append('archive', file!)
    fd.append('mode', mode)
    if (dryRun) fd.append('dry_run', 'true')

    if (skipDocuments) fd.append('skip_documents', 'true')
    if (skipFiles) fd.append('skip_files', 'true')
    if (batchSize !== 500) fd.append('batch_size', String(batchSize))

    if (mode === 'fresh') {
      if (isMultiArchive) fd.append('namespace_map', JSON.stringify(nsMap))
      else if (targetNamespace) fd.append('target_namespace', targetNamespace)
    }

    if (mode === 'merge') {
      fd.append('on_clash', onClash)
      if (addMissing) fd.append('add_missing', 'true')
      if (extendTerminologies) fd.append('extend_terminologies', 'true')
      // A merge may write into a differently-named namespace.
      if (targetNamespace && targetNamespace !== sources[0]) {
        fd.append('target_namespace', targetNamespace)
      }
    } else if (dropStaleReporting) {
      // Refused for a merge: its target is live, so a populated reporting
      // schema is expected and dropping it would discard what we merge into.
      fd.append('drop_stale_reporting', 'true')
    }

    return fd
  }

  /** Client-side guard for the states the backend would refuse anyway. */
  const optionProblem = (): string | null => {
    if (mode === 'fresh') {
      if (isMultiArchive) {
        const blank = sources.filter(s => !nsMap[s]?.trim())
        if (blank.length) {
          return `A fresh restore needs a target for every namespace in the archive — missing: ${blank.join(', ')}.`
        }
      } else if (!targetNamespace.trim()) {
        return 'A fresh restore re-mints every identity, so it needs a target namespace to put them in.'
      }
    }
    return null
  }

  // CASE-705/716: dry_run runs every restore precondition (archive format,
  // empty targets, reporting schema) and reports the outcome without writing
  // anything. Same endpoint, same form — plus the dry_run field.
  const handlePreview = async () => {
    if (!file || unsupported) return
    const problem = optionProblem()
    if (problem) { setError(problem); return }
    setPreviewing(true)
    setError(null)
    setPreviewJob(null)
    try {
      const res = await fetch(apiUrl(RESTORE_URL), {
        method: 'POST',
        body: buildForm(true),
      })
      if (!res.ok) throw new Error(await readError(res))
      const job = await res.json() as BackupJob
      setPreviewJob(job)
      stopPreviewPolling()
      previewPollRef.current = setInterval(async () => {
        try {
          const r = await fetch(apiUrl(`/wip/api/document-store/backup/jobs/${job.job_id}`))
          if (!r.ok) return
          const updated = await r.json() as BackupJob
          setPreviewJob(updated)
          if (updated.status === 'complete' || updated.status === 'failed') stopPreviewPolling()
        } catch { /* ignore */ }
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  const handleRestore = async () => {
    if (!file || unsupported) return
    const problem = optionProblem()
    if (problem) { setError(problem); return }
    setRestoring(true)
    setError(null)
    setWarning(null)
    setPreviewJob(null)
    try {
      const res = await fetch(apiUrl(RESTORE_URL), {
        method: 'POST',
        body: buildForm(false),
      })
      if (!res.ok) throw new Error(await readError(res))
      const job = await res.json() as BackupJob

      // A fresh restore writes to targets the operator chose, so report those
      // rather than the archive's own namespace names.
      if (mode === 'fresh') {
        const targets = isMultiArchive ? sources.map(s => nsMap[s]!) : [targetNamespace]
        setWarning(`Fresh restore — re-minting every identity into ${targets.join(', ')}. Original IDs are NOT preserved.`)
        setActiveJob(job)
        pollRef.current = setInterval(async () => {
          try {
            const r = await fetch(apiUrl(`/wip/api/document-store/backup/jobs/${job.job_id}`))
            if (!r.ok) return
            const updated = await r.json() as BackupJob
            setActiveJob(updated)
            if (updated.status === 'complete' || updated.status === 'failed') stopPolling()
          } catch { /* ignore */ }
        }, 2000)
        return
      }

      // Inform the user which namespace(s) the archive will restore into.
      // The backend reads them from the archive manifest: a single-namespace
      // archive resolves a real target; a combined archive restores each
      // namespace into itself (no single target — the URL anchor is '_').
      const archiveNs = job.namespaces && job.namespaces.length > 0 ? job.namespaces : null
      if (archiveNs) {
        // Explicit list available — name them, flagging which already exist.
        const existing = archiveNs.filter(n => existingPrefixes.has(n))
        const fresh = archiveNs.filter(n => !existingPrefixes.has(n))
        const parts: string[] = []
        if (existing.length) parts.push(`merging/overwriting existing: ${existing.join(', ')}`)
        if (fresh.length) parts.push(`creating new: ${fresh.join(', ')}`)
        setWarning(`Restoring ${archiveNs.length} namespace${archiveNs.length === 1 ? '' : 's'} — ${parts.join('; ')}.`)
      } else if (job.namespace && !PLACEHOLDER_NS.has(job.namespace)) {
        // Single namespace, target resolved from the archive.
        if (existingPrefixes.has(job.namespace)) {
          setWarning(`Restoring into existing namespace "${job.namespace}" — data will be merged/overwritten.`)
        } else {
          setWarning(`Restoring into new namespace "${job.namespace}".`)
        }
      } else {
        // Combined archive whose per-namespace list the backend didn't return.
        setWarning('Restoring multiple namespaces from the archive — each restores into itself (existing data is merged/overwritten).')
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
        Upload a backup archive and choose how to write it back. <strong>Restore</strong> and <strong>merge</strong> preserve
        original IDs; <strong>fresh</strong> re-mints every identity into namespaces you name.
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

      {/* What the archive says it holds — drives the fresh-restore mapping. */}
      {file && manifest && sources.length > 0 && (
        <p className="text-xs text-gray-500">
          Archive holds {sources.length} namespace{sources.length === 1 ? '' : 's'}:{' '}
          <span className="font-mono">{sources.join(', ')}</span>
          {manifest.exported_at && <> · exported {new Date(manifest.exported_at).toLocaleString()}</>}
          {manifest.include_files && <> · with files</>}
        </p>
      )}
      {file && !manifest && (
        <p className="text-xs text-gray-400">
          Could not read the archive manifest — options below are unvalidated and the backend has the final say.
        </p>
      )}

      {file && !unsupported && (
        <RestoreOptions
          mode={mode} setMode={setMode}
          sources={sources} isMultiArchive={isMultiArchive}
          existingPrefixes={existingPrefixes}
          targetNamespace={targetNamespace} setTargetNamespace={setTargetNamespace}
          nsMap={nsMap} setNsMap={setNsMap}
          onClash={onClash} setOnClash={setOnClash}
          addMissing={addMissing} setAddMissing={setAddMissing}
          extendTerminologies={extendTerminologies} setExtendTerminologies={setExtendTerminologies}
          skipDocuments={skipDocuments} setSkipDocuments={setSkipDocuments}
          skipFiles={skipFiles} setSkipFiles={setSkipFiles}
          batchSize={batchSize} setBatchSize={setBatchSize}
          dropStaleReporting={dropStaleReporting} setDropStaleReporting={setDropStaleReporting}
          advanced={advanced} setAdvanced={setAdvanced}
        />
      )}

      {warning && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {warning}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handlePreview}
          disabled={previewing || restoring || !file || unsupported || (activeJob?.status === 'running')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          title="Dry run: checks every precondition and reports the outcome without writing anything"
        >
          {previewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
          {previewing ? 'Starting...' : 'Preview restore'}
        </button>
        <button
          onClick={handleRestore}
          disabled={restoring || !file || unsupported || (activeJob?.status === 'running')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {restoring ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {restoring
            ? 'Starting...'
            : mode === 'restore' ? 'Restore' : mode === 'merge' ? 'Merge into target' : 'Fresh restore'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {previewJob && <PreviewResult job={previewJob} />}

      {activeJob && <JobProgress job={activeJob} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Validate Tab
//
// The referential twin of reporting-sync's parity check: that one compares
// MongoDB against PostgreSQL, this compares MongoDB against itself — every
// reference resolves, every stored identity hash still matches its content.
// It matters most after a restore, which bulk-writes without validating, so a
// restore starts one of these per namespace automatically; this is the same
// check on demand.
//
// Findings never fail the job: the check ran and its answer is the
// deliverable, so a namespace with issues still completes.
// ---------------------------------------------------------------------------

function ValidateTab() {
  const { namespace: globalNs } = useNamespaceFilter()
  const { data: namespaces } = useNamespaces()

  const [ns, setNs] = useState(globalNs || '')
  const [checkTermRefs, setCheckTermRefs] = useState(true)
  const [checkIdentity, setCheckIdentity] = useState(true)
  const [limit, setLimit] = useState(0)
  const [starting, setStarting] = useState(false)
  const [job, setJob] = useState<BackupJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }
  useEffect(() => () => stopPolling(), [])

  const handleStart = async () => {
    if (!ns) return
    setStarting(true)
    setError(null)
    setJob(null)
    try {
      const qs = new URLSearchParams({
        check_term_refs: String(checkTermRefs),
        check_identity: String(checkIdentity),
        limit: String(limit),
      })
      const res = await fetch(
        apiUrl(`/wip/api/document-store/backup/namespaces/${ns}/validate?${qs}`),
        { method: 'POST' },
      )
      if (!res.ok) throw new Error(await readError(res))
      const started = await res.json() as BackupJob
      setJob(started)
      stopPolling()
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(apiUrl(`/wip/api/document-store/backup/jobs/${started.job_id}`))
          if (!r.ok) return
          const updated = await r.json() as BackupJob
          setJob(updated)
          if (updated.status === 'complete' || updated.status === 'failed') stopPolling()
        } catch { /* ignore */ }
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed to start')
    } finally {
      setStarting(false)
    }
  }

  const running = job != null && job.status !== 'complete' && job.status !== 'failed'

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Check that a namespace is internally consistent — every template, term, document and file reference resolves,
        and every document's stored identity hash still matches its content. Findings do not fail the check.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={ns}
          onChange={e => setNs(e.target.value)}
          className="border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light"
        >
          <option value="">Namespace…</option>
          {(namespaces ?? []).map(n => (
            <option key={n.prefix} value={n.prefix}>{n.prefix}</option>
          ))}
        </select>
        <button
          onClick={handleStart}
          disabled={starting || !ns || running}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {starting || running ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {starting ? 'Starting…' : running ? 'Validating…' : 'Validate namespace'}
        </button>
      </div>

      <div className="space-y-2">
        <OptionCheckbox
          checked={checkTermRefs}
          onChange={setCheckTermRefs}
          label="Check term references"
          blurb="One cached lookup per distinct term, so the cost scales with vocabulary size rather than document count."
        />
        <OptionCheckbox
          checked={checkIdentity}
          onChange={setCheckIdentity}
          label="Recompute identity hashes"
          blurb="Recompute each document's hash from its own data and compare it to the stored one."
        />
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <span>Limit</span>
          <input
            type="number"
            min={0}
            value={limit}
            onChange={e => setLimit(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-light"
          />
          <span className="text-gray-400">documents (0 = all)</span>
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {job && <JobProgress job={job} />}
      {job?.result && <IntegrityResultCard result={job.result} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Namespace integrity result (validate jobs)
// ---------------------------------------------------------------------------

const SUMMARY_LABELS: Array<[keyof NamespaceIntegrityResult['summary'], string]> = [
  ['total_documents', 'Documents'],
  ['documents_checked', 'Checked'],
  ['documents_with_issues', 'With issues'],
  ['orphaned_template_refs', 'Orphaned template refs'],
  ['orphaned_term_refs', 'Orphaned term refs'],
  ['inactive_template_refs', 'Inactive template refs'],
  ['orphaned_document_refs', 'Orphaned document refs'],
  ['orphaned_file_refs', 'Orphaned file refs'],
  ['identity_hash_mismatches', 'Identity hash mismatches'],
]

/**
 * `BackupJobSnapshot.result` is polymorphic — a validate job stores a
 * NamespaceIntegrityResult, but a restore dry run stores its plan in the same
 * field (the terminal event's details land there verbatim).
 *
 * CASE-750 gave the integrity payload a self-identifying `result_kind:
 * "namespace_integrity"`, so the discriminator is the primary test now. The
 * structural fallback (`summary != null`) stays for jobs written before that
 * shipped — pre-existing validate jobs in the list carry no result_kind — and
 * costs nothing.
 */
function isIntegrityResult(job: BackupJob): boolean {
  if ((job.kind ?? job.type) !== 'validate') return false
  if (job.result == null || typeof job.result !== 'object') return false
  const r = job.result as { result_kind?: unknown; summary?: unknown }
  if (r.result_kind != null) return r.result_kind === 'namespace_integrity'
  return r.summary != null
}

function IntegrityResultCard({ result }: { result: NamespaceIntegrityResult }) {
  // Defensive against a partially-populated result: the summary keys and the
  // issues array are read individually below, and a missing one must render
  // as absent rather than crashing the whole page.
  const summary = result.summary ?? ({} as NamespaceIntegrityResult['summary'])
  const issues = result.issues ?? []
  const tone =
    result.status === 'healthy' ? 'success' : result.status === 'warning' ? 'amber' : 'danger'

  return (
    <div className={cn(
      'border rounded-lg p-4 space-y-3',
      tone === 'success' ? 'bg-success/5 border-success/30'
        : tone === 'amber' ? 'bg-amber-50 border-amber-200'
          : 'bg-danger/5 border-danger/20',
    )}>
      <div className="flex items-center gap-2">
        {tone === 'success'
          ? <CheckCircle size={16} className="text-success" />
          : tone === 'amber'
            ? <AlertTriangle size={16} className="text-amber-600" />
            : <XCircle size={16} className="text-danger" />}
        <span className={cn(
          'text-sm font-medium',
          tone === 'success' ? 'text-success' : tone === 'amber' ? 'text-amber-800' : 'text-danger',
        )}>
          {result.status === 'healthy'
            ? 'Namespace is internally consistent'
            : `Integrity ${result.status}`}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
        {SUMMARY_LABELS.map(([key, label]) => {
          const value = summary[key]
          if (value == null) return null
          // Only the count-of-problems rows earn emphasis; the totals are context.
          const isProblem = key !== 'total_documents' && key !== 'documents_checked' && value > 0
          return (
            <div key={key} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-gray-500 truncate">{label}</span>
              <span className={cn('font-mono', isProblem ? 'text-danger font-medium' : 'text-gray-700')}>
                {value.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>

      {issues.length > 0 && (
        <div className="space-y-1">
          <span className="block text-xs font-medium text-gray-500">
            Issues{(result.issues_truncated ?? 0) > 0 && ` (showing ${issues.length}, ${result.issues_truncated.toLocaleString()} more not listed)`}
          </span>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded bg-white">
            {issues.map((issue, i) => (
              <div key={`${issue.document_id}-${i}`} className="px-2.5 py-1.5 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded border',
                    issue.severity === 'error' ? 'bg-danger/5 text-danger border-danger/20'
                      : issue.severity === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-gray-50 text-gray-500 border-gray-200',
                  )}>
                    {issue.severity}
                  </span>
                  <span className="font-mono text-gray-500">{issue.type}</span>
                  {issue.field_path && <span className="font-mono text-gray-400">{issue.field_path}</span>}
                </div>
                <p className="text-gray-600 mt-0.5">{issue.message}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                  doc {issue.document_id}{issue.reference && <> → {issue.reference}</>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Restore Options
//
// The three modes are genuinely different operations, not flag combinations,
// so the form shows only what the chosen mode accepts — the backend rejects
// cross-mode options (namespace_map outside 'fresh', drop_stale_reporting on a
// merge) rather than ignoring them.
// ---------------------------------------------------------------------------

const MODES: Array<{ value: RestoreMode; label: string; blurb: string }> = [
  {
    value: 'restore',
    label: 'Restore',
    blurb: 'ID-preserving. Each namespace in the archive is written back to itself; targets must be empty or absent.',
  },
  {
    value: 'merge',
    label: 'Merge',
    blurb: 'ID-preserving, into a namespace that already holds data. Definitions must be compatible; documents resolve by the clash policy.',
  },
  {
    value: 'fresh',
    label: 'Fresh',
    blurb: 'Re-mints every identity into namespaces you name. Use to clone an archive alongside the live original.',
  },
]

const CLASH_POLICIES: Array<{ value: ClashPolicy; label: string; blurb: string }> = [
  { value: 'skip', label: 'Skip', blurb: 'Keep what the target already has.' },
  { value: 'overwrite', label: 'Overwrite', blurb: 'The archive wins.' },
  { value: 'newer', label: 'Newer wins', blurb: 'Compare timestamps and keep the more recent.' },
]

function OptionCheckbox({
  checked, onChange, label, blurb, disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  blurb: string
  disabled?: boolean
}) {
  return (
    <label className={cn(
      'flex items-start gap-2 text-sm cursor-pointer',
      disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700',
    )}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="rounded border-gray-300 mt-0.5"
      />
      <span>
        {label}
        <span className="block text-[11px] text-gray-400">{blurb}</span>
      </span>
    </label>
  )
}

function RestoreOptions(p: {
  mode: RestoreMode; setMode: (m: RestoreMode) => void
  sources: string[]; isMultiArchive: boolean
  existingPrefixes: Set<string>
  targetNamespace: string; setTargetNamespace: (v: string) => void
  nsMap: Record<string, string>; setNsMap: (v: Record<string, string>) => void
  onClash: ClashPolicy; setOnClash: (v: ClashPolicy) => void
  addMissing: boolean; setAddMissing: (v: boolean) => void
  extendTerminologies: boolean; setExtendTerminologies: (v: boolean) => void
  skipDocuments: boolean; setSkipDocuments: (v: boolean) => void
  skipFiles: boolean; setSkipFiles: (v: boolean) => void
  batchSize: number; setBatchSize: (v: number) => void
  dropStaleReporting: boolean; setDropStaleReporting: (v: boolean) => void
  advanced: boolean; setAdvanced: (v: boolean) => void
}) {
  const active = MODES.find(m => m.value === p.mode)!

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
      {/* Mode */}
      <div className="space-y-2">
        <span className="block text-xs font-medium text-gray-500">Mode</span>
        <div className="flex flex-wrap gap-1">
          {MODES.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => p.setMode(m.value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md border transition-colors',
                p.mode === m.value
                  ? 'border-primary/30 bg-primary/5 text-primary-dark font-medium'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">{active.blurb}</p>
      </div>

      {/* Fresh — where the re-minted identities go */}
      {p.mode === 'fresh' && (
        p.isMultiArchive ? (
          <div className="space-y-2">
            <span className="block text-xs font-medium text-gray-500">
              Target for every namespace in the archive
            </span>
            <p className="text-[11px] text-gray-400">
              Required — there is no default, because restoring a namespace under its own name would collide with the
              live original. Several sources may share one target.
            </p>
            <div className="space-y-1.5">
              {p.sources.map(src => {
                const target = p.nsMap[src] ?? ''
                const collides = target.trim() !== '' && p.existingPrefixes.has(target.trim())
                return (
                  <div key={src} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-500 w-40 truncate shrink-0" title={src}>{src}</span>
                    <span className="text-gray-300 shrink-0">→</span>
                    <input
                      type="text"
                      value={target}
                      onChange={e => p.setNsMap({ ...p.nsMap, [src]: e.target.value })}
                      placeholder="target namespace"
                      className={cn(
                        'flex-1 border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1',
                        collides
                          ? 'border-amber-300 focus:ring-amber-300'
                          : 'border-gray-200 focus:ring-primary-light focus:border-primary-light',
                      )}
                    />
                    {collides && (
                      <span className="text-[11px] text-amber-600 shrink-0" title="A fresh restore only allows a same-name target when that namespace is absent or empty">
                        exists
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">Target namespace</label>
            <input
              type="text"
              value={p.targetNamespace}
              onChange={e => p.setTargetNamespace(e.target.value)}
              placeholder="where the re-minted identities go"
              className="w-full max-w-sm border border-gray-200 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light"
            />
            {p.targetNamespace.trim() !== '' && p.existingPrefixes.has(p.targetNamespace.trim()) && (
              <p className="text-[11px] text-amber-600">
                <span className="font-mono">{p.targetNamespace.trim()}</span> already exists — a fresh restore needs it
                to be absent or empty.
              </p>
            )}
          </div>
        )
      )}

      {/* Merge — how conflicts resolve */}
      {p.mode === 'merge' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">Target namespace (optional)</label>
            <input
              type="text"
              value={p.targetNamespace}
              onChange={e => p.setTargetNamespace(e.target.value)}
              placeholder={p.sources[0] ?? 'from the archive manifest'}
              className="w-full max-w-sm border border-gray-200 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light"
            />
            <p className="text-[11px] text-gray-400">A merge may write into a differently-named namespace. Leave blank to use the archive's.</p>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-gray-500">When a document identity already exists</span>
            <div className="flex flex-wrap gap-1">
              {CLASH_POLICIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => p.setOnClash(c.value)}
                  title={c.blurb}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md border transition-colors',
                    p.onClash === c.value
                      ? 'border-primary/30 bg-primary/5 text-primary-dark font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">
              {CLASH_POLICIES.find(c => c.value === p.onClash)!.blurb}
            </p>
          </div>

          <OptionCheckbox
            checked={p.addMissing}
            onChange={p.setAddMissing}
            label="Add missing terminologies and templates"
            blurb="Without this a definition the target lacks refuses the merge — changing a live namespace's definitions is an active decision, not a side effect."
          />
          <OptionCheckbox
            checked={p.extendTerminologies}
            onChange={p.setExtendTerminologies}
            label="Extend terminologies with missing terms"
            blurb="Separate from the above on purpose: new vocabulary in a live terminology is its own decision."
          />
        </div>
      )}

      {/* Applies to every mode */}
      <div className="space-y-2 pt-1">
        <OptionCheckbox
          checked={p.skipDocuments}
          onChange={p.setSkipDocuments}
          label="Skip documents"
          blurb="Restore definitions only — terminologies, terms and templates."
        />
        <OptionCheckbox
          checked={p.skipFiles}
          onChange={p.setSkipFiles}
          label="Skip files"
          blurb="Ignore file blobs even when the archive carries them."
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => p.setAdvanced(!p.advanced)}
          className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
        >
          {p.advanced ? 'Hide advanced' : 'Advanced…'}
        </button>
        {p.advanced && (
          <div className="mt-2 space-y-2">
            <OptionCheckbox
              checked={p.mode === 'merge' ? false : p.dropStaleReporting}
              onChange={p.setDropStaleReporting}
              disabled={p.mode === 'merge'}
              label="Drop a stale reporting schema for the target"
              blurb={p.mode === 'merge'
                ? 'Not available for a merge — its target is live, so a populated reporting schema is expected and dropping it would discard what you are merging into.'
                : 'Instead of refusing when the target namespace still has one. A dry run reports the would-drop only.'}
            />
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span>Batch size</span>
              <input
                type="number"
                min={1}
                max={500}
                value={p.batchSize}
                onChange={e => p.setBatchSize(Math.min(500, Math.max(1, Number(e.target.value) || 500)))}
                className="w-20 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-light"
              />
              <span className="text-gray-400">documents per write (1–500)</span>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Restore Preview Result (dry run — CASE-705)
// ---------------------------------------------------------------------------

function PreviewResult({ job }: { job: BackupJob }) {
  const terminal = job.status === 'complete' || job.status === 'failed'
  const ok = job.status === 'complete'
  return (
    <div className={cn(
      'border rounded-lg p-4 space-y-1.5',
      !terminal ? 'bg-white border-gray-200' : ok ? 'bg-success/5 border-success/30' : 'bg-danger/5 border-danger/20',
    )}>
      <div className="flex items-center gap-2">
        {!terminal
          ? <Loader2 size={16} className="animate-spin text-primary" />
          : ok
            ? <CheckCircle size={16} className="text-success" />
            : <XCircle size={16} className="text-danger" />}
        <span className={cn('text-sm font-medium', !terminal ? 'text-primary' : ok ? 'text-success' : 'text-danger')}>
          {!terminal ? 'Previewing restore…' : ok ? 'Preview: restore would succeed' : 'Preview: restore would not proceed'}
        </span>
        <span className="ml-auto text-xs font-mono text-gray-400">{job.job_id}</span>
      </div>
      <p className="text-xs text-gray-500">Dry run — nothing was written.</p>
      {job.namespaces && job.namespaces.length > 0 && (
        <p className="text-xs text-gray-500">
          Namespace{job.namespaces.length !== 1 ? 's' : ''}: {job.namespaces.join(', ')}
        </p>
      )}
      {job.message && (
        <p className={cn('text-xs whitespace-pre-wrap', terminal && !ok ? 'text-danger' : 'text-gray-500')}>
          {job.message}
        </p>
      )}
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
          {job.namespace && (
            <span className="text-xs text-gray-400" title={job.namespaces?.join(', ')}>
              {jobNamespaceLabel(job)}
            </span>
          )}
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

      {/* Non-fatal notes. A job can complete and still have something to say. */}
      {job.warnings && job.warnings.length > 0 && (
        <ul className="space-y-0.5">
          {job.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle size={11} className="shrink-0 mt-0.5" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      {/* A completed restore starts one validation per namespace it wrote and
          does NOT wait for them — the data is committed either way, so these
          are a follow-up to check, not a gate that passed. */}
      {job.validation_job_ids && job.validation_job_ids.length > 0 && (
        <p className="text-xs text-gray-500">
          Started {job.validation_job_ids.length} integrity check
          {job.validation_job_ids.length === 1 ? '' : 's'} on the restored namespace
          {job.validation_job_ids.length === 1 ? '' : 's'} — the restore did not wait for
          {job.validation_job_ids.length === 1 ? ' it' : ' them'}. See the jobs list below.
        </p>
      )}

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
  const [expanded, setExpanded] = useState<string | null>(null)

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
            <div key={job.job_id}>
            <div className="flex items-center gap-3 px-4 py-2.5 text-xs">
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'font-medium',
                  (job.kind ?? job.type) === 'backup' ? 'text-primary'
                    : (job.kind ?? job.type) === 'validate' ? 'text-gray-600'
                      : 'text-success',
                )}>{job.kind ?? job.type ?? 'job'}</span>
                <span className="text-gray-400 ml-2" title={job.namespaces?.join(', ')}>
                  {jobNamespaceLabel(job)}
                </span>
                {/* block + truncate, not an inline span: a failed job's message
                    can be a paragraph of refusal detail, and inline truncate
                    does not constrain it — it used to overflow the card and
                    give the whole page a horizontal scrollbar. */}
                {job.message && (
                  <span className="block text-gray-400 truncate" title={job.message}>
                    {job.message}
                  </span>
                )}
              </div>
              {/* A validate job's findings are its whole point, so let the row
                  open them. Two guards, both load-bearing: `result` is
                  polymorphic (a restore dry run stores its plan in the same
                  field, which is NOT an integrity result), and the backend
                  only sometimes persists a validate result at all — it is
                  written in a second pass that races the terminal-event save. */}
              {isIntegrityResult(job) && (
                <button
                  onClick={() => setExpanded(expanded === job.job_id ? null : job.job_id)}
                  className="text-gray-400 hover:text-gray-600 underline underline-offset-2"
                >
                  {expanded === job.job_id ? 'hide findings' : 'findings'}
                </button>
              )}
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
            {expanded === job.job_id && isIntegrityResult(job) && (
              <div className="px-4 pb-3">
                <IntegrityResultCard result={job.result!} />
              </div>
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
  const [tab, setTab] = useState<'backup' | 'restore' | 'validate'>('backup')

  const TABS = [
    { id: 'backup' as const, icon: Download, label: 'Backup' },
    { id: 'restore' as const, icon: Upload, label: 'Restore' },
    { id: 'validate' as const, icon: ShieldCheck, label: 'Validate' },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Backup & Restore</h1>
        <p className="text-sm text-gray-400 mt-1">Export namespaces as archives, restore them, and verify what landed.</p>
      </div>

      {/* Tab selector */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <span className="flex items-center gap-1.5"><t.icon size={14} /> {t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'backup' ? <BackupTab /> : tab === 'restore' ? <RestoreTab /> : <ValidateTab />}

      {/* Jobs list */}
      <JobsList />
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  // Whole-instance archives run to gigabytes; without this they rendered as
  // four-digit MB.
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
