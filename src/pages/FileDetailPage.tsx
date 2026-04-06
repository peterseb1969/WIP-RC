import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  FileIcon,
  ArrowLeft,
  Calendar,
  HardDrive,
  User,
  Download,
  Copy,
  Check,
  FolderTree,
  FileText,
  Tag,
  AlertTriangle,
  LinkIcon,
} from 'lucide-react'
import { useFile, useDownloadUrl, useWipClient } from '@wip/react'
import { useQuery } from '@tanstack/react-query'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import JsonViewer from '@/components/common/JsonViewer'

// ---------------------------------------------------------------------------
// Content-type-aware icon
// ---------------------------------------------------------------------------

function fileTypeIcon(contentType: string, size: number = 24) {
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

// ---------------------------------------------------------------------------
// Image preview
// ---------------------------------------------------------------------------

function ImagePreview({ downloadUrl, filename }: { downloadUrl: string; filename: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Preview</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-center">
        <img
          src={downloadUrl}
          alt={filename}
          className="max-h-96 max-w-full rounded object-contain"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

function DuplicateFiles({ checksum, currentFileId }: { checksum: string; currentFileId: string }) {
  const client = useWipClient()
  const { data: duplicates } = useQuery({
    queryKey: ['rc-console', 'file-duplicates', checksum],
    queryFn: () => client.files.findByChecksum(checksum),
    enabled: !!checksum,
  })

  const others = (duplicates ?? []).filter(f => f.file_id !== currentFileId)
  if (others.length === 0) return null

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Duplicates ({others.length} other file{others.length !== 1 ? 's' : ''} with same checksum)
      </h2>
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {others.map(f => (
          <Link
            key={f.file_id}
            to={`/files/${f.file_id}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
          >
            {fileTypeIcon(f.content_type, 14)}
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-800 truncate">{f.filename}</span>
              <span className="text-xs text-gray-400 ml-2">{f.namespace}</span>
            </div>
            <span className="text-xs text-gray-400">{formatBytes(f.size_bytes)}</span>
            <StatusBadge status={f.status === 'active' ? 'active' : f.status === 'orphan' ? 'warning' : 'inactive'} label={f.status} />
          </Link>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Metadata row
// ---------------------------------------------------------------------------

function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className="text-sm text-gray-500 shrink-0 min-w-[120px]">{label}</span>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Referencing documents
// ---------------------------------------------------------------------------

function ReferencingDocuments({ fileId }: { fileId: string }) {
  const client = useWipClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['rc-console', 'file-documents', fileId],
    queryFn: () => client.files.getFileDocuments(fileId),
    enabled: !!fileId,
  })

  if (isLoading) return <LoadingState label="Loading references..." />
  if (error) return <ErrorState message={(error as Error).message} />

  const items = data?.items ?? []

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
        <AlertTriangle size={14} />
        <span>No documents reference this file — it may be an orphan.</span>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
      {items.map(ref => (
        <Link
          key={`${ref.document_id}-${ref.field_path}`}
          to={`/documents/${ref.template_value ?? '_'}/${ref.document_id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <FileText size={14} className="text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-600">{ref.document_id}</span>
              <CopyButton value={ref.document_id} />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              {ref.template_value && <span className="text-indigo-500">{ref.template_value}</span>}
              <span className="flex items-center gap-1"><LinkIcon size={10} /> field: {ref.field_path}</span>
              <StatusBadge status={ref.status === 'active' ? 'active' : 'inactive'} label={ref.status} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// File Detail Page
// ---------------------------------------------------------------------------

export default function FileDetailPage() {
  const { id } = useParams()
  const { data: file, isLoading, error } = useFile(id ?? '')
  const { data: downloadInfo } = useDownloadUrl(id ?? '')

  if (isLoading) return <LoadingState label="Loading file..." />
  if (error) return <ErrorState message={error.message} />
  if (!file) return <ErrorState message="File not found" />

  const isOrphan = file.status === 'orphan' || file.reference_count === 0
  const fileStatus = file.status === 'active' ? 'active' : file.status === 'orphan' ? 'warning' : 'inactive'

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          to="/files"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 mb-2"
        >
          <ArrowLeft size={12} />
          Back to Files
        </Link>
        <div className="flex items-center gap-3">
          {fileTypeIcon(file.content_type)}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
              <span className="truncate">{file.filename}</span>
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
                {file.file_id}
                <CopyButton value={file.file_id} />
              </span>
              {file.namespace && (
                <Link
                  to={`/?ns=${file.namespace}`}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 bg-gray-100 px-1.5 py-0.5 rounded"
                >
                  <FolderTree size={10} />
                  {file.namespace}
                </Link>
              )}
              <StatusBadge status={fileStatus} label={file.status} />
              {isOrphan && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  <AlertTriangle size={10} />
                  orphan
                </span>
              )}
            </div>
          </div>
          {downloadInfo?.download_url && (
            <a
              href={downloadInfo.download_url}
              download={file.filename}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors shrink-0"
            >
              <Download size={14} />
              Download
            </a>
          )}
        </div>
      </div>

      {/* File properties */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Properties</h2>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          <MetadataRow label="Content Type">{file.content_type}</MetadataRow>
          <MetadataRow label="Size">
            <span className="flex items-center gap-1">
              <HardDrive size={12} className="text-gray-400" />
              {formatBytes(file.size_bytes)} ({file.size_bytes.toLocaleString()} bytes)
            </span>
          </MetadataRow>
          <MetadataRow label="Checksum">
            <span className="font-mono text-xs text-gray-500 flex items-center gap-1">
              {file.checksum}
              <CopyButton value={file.checksum} />
            </span>
          </MetadataRow>
          <MetadataRow label="References">
            <span className={file.reference_count === 0 ? 'text-amber-600' : 'text-gray-800'}>
              {file.reference_count} document{file.reference_count !== 1 ? 's' : ''}
            </span>
          </MetadataRow>
          {file.uploaded_at && (
            <MetadataRow label="Uploaded">
              <span className="flex items-center gap-1">
                <Calendar size={12} className="text-gray-400" />
                {new Date(file.uploaded_at).toLocaleString()}
              </span>
            </MetadataRow>
          )}
          {file.uploaded_by && (
            <MetadataRow label="Uploaded By">
              <span className="flex items-center gap-1">
                <User size={12} className="text-gray-400" />
                {file.uploaded_by}
              </span>
            </MetadataRow>
          )}
          {file.updated_at && file.updated_at !== file.uploaded_at && (
            <MetadataRow label="Updated">{new Date(file.updated_at).toLocaleString()}</MetadataRow>
          )}
        </div>
      </div>

      {/* File metadata (description, tags, category) */}
      {file.metadata && (file.metadata.description || file.metadata.tags?.length > 0 || file.metadata.category) && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Metadata</h2>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {file.metadata.description && (
              <MetadataRow label="Description">{file.metadata.description}</MetadataRow>
            )}
            {file.metadata.category && (
              <MetadataRow label="Category">
                <span className="inline-flex items-center bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{file.metadata.category}</span>
              </MetadataRow>
            )}
            {file.metadata.tags && file.metadata.tags.length > 0 && (
              <MetadataRow label="Tags">
                <div className="flex flex-wrap gap-1.5">
                  {file.metadata.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
                      <Tag size={10} />
                      {tag}
                    </span>
                  ))}
                </div>
              </MetadataRow>
            )}
          </div>
        </div>
      )}

      {/* Allowed templates */}
      {file.allowed_templates && file.allowed_templates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Allowed Templates</h2>
          <div className="flex flex-wrap gap-1.5">
            {file.allowed_templates.map(tpl => (
              <span key={tpl} className="inline-flex items-center bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-mono">
                {tpl}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Image preview */}
      {file.content_type.startsWith('image/') && downloadInfo?.download_url && (
        <ImagePreview downloadUrl={downloadInfo.download_url} filename={file.filename} />
      )}

      {/* Duplicate detection */}
      <DuplicateFiles checksum={file.checksum} currentFileId={file.file_id} />

      {/* Referencing documents */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Referencing Documents ({file.reference_count})
        </h2>
        <ReferencingDocuments fileId={file.file_id} />
      </div>

      {/* Raw JSON */}
      <details className="group">
        <summary className="text-sm font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700">
          Raw JSON
        </summary>
        <div className="mt-2">
          <JsonViewer data={file} maxHeight="400px" collapsed />
        </div>
      </details>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
