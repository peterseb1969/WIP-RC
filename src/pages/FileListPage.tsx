import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { FileIcon, Calendar, Hash, RefreshCw, HardDrive, ChevronRight, AlertTriangle, Upload, Plus, X, Trash2, Search as SearchIcon, Loader2 } from 'lucide-react'
import { useFiles, useUploadFile, useNamespaces, useWipClient } from '@wip/react'
import type { FileEntity } from '@wip/client'
import Pagination from '@/components/common/Pagination'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import { useNamespaceFilter, useSyncNamespaceFromUrl } from '@/hooks/use-namespace-filter'

// ---------------------------------------------------------------------------
// Upload form
// ---------------------------------------------------------------------------

function UploadForm({ defaultNamespace, onClose }: { defaultNamespace?: string; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [category, setCategory] = useState('')
  const [uploadNs, setUploadNs] = useState(defaultNamespace ?? '')
  const [error, setError] = useState<string | null>(null)

  const { data: namespacesData } = useNamespaces()
  const upload = useUploadFile({
    onSuccess: () => onClose(),
    onError: (err: Error) => setError(err.message),
  })

  const handleUpload = () => {
    if (!selectedFile) { setError('Select a file'); return }
    if (!uploadNs) { setError('Namespace is required'); return }
    const metadata: Record<string, unknown> = {}
    if (description.trim()) metadata.description = description.trim()
    if (tags.trim()) metadata.tags = tags.split(',').map(t => t.trim()).filter(Boolean)
    if (category.trim()) metadata.category = category.trim()
    upload.mutate({
      file: selectedFile,
      filename: selectedFile.name,
      metadata,
      namespace: uploadNs,
    })
  }

  return (
    <div className="bg-white border border-primary/20 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Upload File</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
      <div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={e => { setSelectedFile(e.target.files?.[0] ?? null); setError(null) }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-lg py-6 text-sm text-gray-400 hover:border-primary/30 hover:text-primary transition-colors flex flex-col items-center gap-1"
        >
          <Upload size={20} />
          {selectedFile ? (
            <span className="text-gray-700 font-medium">{selectedFile.name} ({formatBytes(selectedFile.size)})</span>
          ) : (
            <span>Click to select a file</span>
          )}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Namespace *</label>
          <select
            value={uploadNs}
            onChange={e => setUploadNs(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
          >
            <option value="">Select namespace...</option>
            {(namespacesData ?? []).map(n => (
              <option key={n.prefix} value={n.prefix}>{n.prefix}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="e.g. receipt, report"
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
          className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tags (comma-separated)</label>
        <input
          type="text"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="tag1, tag2"
          className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleUpload}
          disabled={upload.isPending || !selectedFile}
          className="px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {upload.isPending ? 'Uploading...' : 'Upload'}
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

// ---------------------------------------------------------------------------
// File List Page
// ---------------------------------------------------------------------------

export default function FileListPage() {
  useSyncNamespaceFromUrl()
  const { namespace } = useNamespaceFilter()
  const [page, setPage] = useState(1)
  // Default to All (not Active) so freshly uploaded files appear — the
  // backend often marks ref_count=0 files as 'orphan', which the Active
  // filter would hide. The per-row orphan badge calls them out visually.
  const [status, setStatus] = useState<'active' | 'inactive' | ''>('')
  const [showUpload, setShowUpload] = useState(false)
  const { data, isLoading, error, refetch } = useFiles({
    namespace: namespace || undefined,
    status: status || undefined,
    page,
    page_size: 25,
  })

  const items = data?.items ?? []

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Files</h1>
          <p className="text-sm text-gray-400 mt-1">File storage management</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUpload(s => !s)}
            className="inline-flex items-center gap-1 px-3 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark"
          >
            <Plus size={14} />
            Upload
          </button>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value as typeof status); setPage(1) }}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-light"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="">All</option>
          </select>
          <button onClick={() => refetch()} className="p-2 border border-gray-200 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {showUpload && (
        <UploadForm defaultNamespace={namespace} onClose={() => setShowUpload(false)} />
      )}

      <OrphanScanner />

      {isLoading && <LoadingState label="Loading files..." />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">No files found.</p>
            ) : (
              items.map(f => {
                const isOrphan = f.status === 'orphan' || f.reference_count === 0
                return (
                  <Link key={f.file_id} to={`/files/${f.file_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    {fileTypeIcon(f.content_type)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{f.filename}</div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        <span>{f.content_type}</span>
                        <span className="flex items-center gap-1"><HardDrive size={10} />{formatBytes(f.size_bytes ?? 0)}</span>
                        <span className="flex items-center gap-1"><Hash size={10} />{f.file_id}</span>
                        {!namespace && f.namespace && (
                          <span className="text-primary">{f.namespace}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOrphan && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          <AlertTriangle size={10} />
                          orphan
                        </span>
                      )}
                      {f.uploaded_at && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(f.uploaded_at).toLocaleDateString()}
                        </span>
                      )}
                      <StatusBadge status={f.status === 'active' ? 'active' : f.status === 'orphan' ? 'warning' : 'inactive'} label={f.status} />
                    </div>
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </Link>
                )
              })
            )}
          </div>
          <Pagination page={page} totalPages={data.pages ?? 1} onPageChange={setPage} />
          <p className="text-xs text-gray-400">{data.total ?? 0} file{(data.total ?? 0) !== 1 ? 's' : ''}</p>
        </>
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// Orphan Scanner
// ---------------------------------------------------------------------------

function OrphanScanner() {
  const client = useWipClient()
  const [orphans, setOrphans] = useState<FileEntity[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [olderThanHours, setOlderThanHours] = useState(0)
  const [scanError, setScanError] = useState<string | null>(null)
  const [deleteResult, setDeleteResult] = useState<{ succeeded: number; failed: number } | null>(null)

  const handleScan = useCallback(async () => {
    setScanning(true)
    setScanError(null)
    setOrphans(null)
    setSelected(new Set())
    setDeleteResult(null)
    try {
      const result = await client.files.listOrphans({
        older_than_hours: olderThanHours || undefined,
        limit: 200,
      })
      setOrphans(result)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }, [client, olderThanHours])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (!orphans) return
    if (selected.size === orphans.length) setSelected(new Set())
    else setSelected(new Set(orphans.map(f => f.file_id)))
  }

  const handleDelete = async () => {
    if (selected.size === 0) return
    setDeleting(true)
    try {
      const res = await client.files.deleteFiles(Array.from(selected))
      setDeleteResult({ succeeded: res.succeeded, failed: res.failed })
      // Re-scan to refresh
      const result = await client.files.listOrphans({ older_than_hours: olderThanHours || undefined, limit: 200 })
      setOrphans(result)
      setSelected(new Set())
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-500" />
        Orphan Scanner
      </h2>
      <p className="text-xs text-gray-400">Find files with no document references. These may be leftover from abandoned uploads.</p>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Older than (hours)</label>
            <input
              type="number"
              value={olderThanHours}
              onChange={e => setOlderThanHours(Number(e.target.value))}
              min={0}
              placeholder="0 = all"
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-24 focus:outline-none focus:border-primary-light"
            />
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary disabled:opacity-50"
          >
            {scanning ? <Loader2 size={12} className="animate-spin" /> : <SearchIcon size={12} />}
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        {scanError && <p className="text-xs text-danger">{scanError}</p>}
        {deleteResult && (
          <p className="text-xs text-success">
            Deleted {deleteResult.succeeded} file{deleteResult.succeeded !== 1 ? 's' : ''}
            {deleteResult.failed > 0 && <span className="text-danger"> ({deleteResult.failed} failed)</span>}
          </p>
        )}

        {orphans !== null && (
          <>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{orphans.length} orphan{orphans.length !== 1 ? 's' : ''} found</span>
              {orphans.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={selectAll} className="text-primary hover:text-primary-dark">
                    {selected.size === orphans.length ? 'Deselect all' : 'Select all'}
                  </button>
                  {selected.size > 0 && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-danger border border-danger/20 rounded hover:bg-danger/5 disabled:opacity-50"
                    >
                      <Trash2 size={10} />
                      {deleting ? 'Deleting...' : `Delete ${selected.size}`}
                    </button>
                  )}
                </div>
              )}
            </div>
            {orphans.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {orphans.map(f => (
                  <label key={f.file_id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selected.has(f.file_id)}
                      onChange={() => toggleSelect(f.file_id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-700 truncate flex-1">{f.filename}</span>
                    <span className="text-gray-400">{formatBytes(f.size_bytes ?? 0)}</span>
                    <span className="text-gray-400">{f.content_type}</span>
                    {f.uploaded_at && <span className="text-gray-300">{new Date(f.uploaded_at).toLocaleDateString()}</span>}
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function fileTypeIcon(contentType: string) {
  const size = 16
  const cls = "shrink-0"
  if (contentType.startsWith('image/')) return <FileIcon size={size} className={`${cls} text-pink-400`} />
  if (contentType === 'application/pdf') return <FileIcon size={size} className={`${cls} text-danger/60`} />
  if (contentType.includes('csv') || contentType.includes('spreadsheet') || contentType.includes('excel'))
    return <FileIcon size={size} className={`${cls} text-success`} />
  if (contentType.startsWith('text/')) return <FileIcon size={size} className={`${cls} text-primary-light`} />
  if (contentType.includes('json') || contentType.includes('xml'))
    return <FileIcon size={size} className={`${cls} text-amber-400`} />
  return <FileIcon size={size} className={`${cls} text-gray-400`} />
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
