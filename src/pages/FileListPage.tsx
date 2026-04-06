import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { FileIcon, Calendar, Hash, RefreshCw, HardDrive, ChevronRight, AlertTriangle, Upload, Plus, X } from 'lucide-react'
import { useFiles, useUploadFile, useNamespaces } from '@wip/react'
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
      metadata: { ...metadata, namespace: uploadNs } as never,
    })
  }

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-4 space-y-3">
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
          className="w-full border-2 border-dashed border-gray-200 rounded-lg py-6 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex flex-col items-center gap-1"
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
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
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
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
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
          className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tags (comma-separated)</label>
        <input
          type="text"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="tag1, tag2"
          className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleUpload}
          disabled={upload.isPending || !selectedFile}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
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
  const [status, setStatus] = useState<'active' | 'inactive' | ''>('active')
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
            className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            <Plus size={14} />
            Upload
          </button>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value as typeof status); setPage(1) }}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
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
                          <span className="text-blue-500">{f.namespace}</span>
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

function fileTypeIcon(contentType: string) {
  const size = 16
  const cls = "shrink-0"
  if (contentType.startsWith('image/')) return <FileIcon size={size} className={`${cls} text-pink-400`} />
  if (contentType === 'application/pdf') return <FileIcon size={size} className={`${cls} text-red-400`} />
  if (contentType.includes('csv') || contentType.includes('spreadsheet') || contentType.includes('excel'))
    return <FileIcon size={size} className={`${cls} text-green-500`} />
  if (contentType.startsWith('text/')) return <FileIcon size={size} className={`${cls} text-blue-400`} />
  if (contentType.includes('json') || contentType.includes('xml'))
    return <FileIcon size={size} className={`${cls} text-amber-400`} />
  return <FileIcon size={size} className={`${cls} text-gray-400`} />
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
