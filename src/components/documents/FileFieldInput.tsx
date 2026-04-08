import { useState, useRef } from 'react'
import { Upload, File as FileIcon, X, Loader2 } from 'lucide-react'
import { useUploadFile, useFile } from '@wip/react'
import type { FieldDefinition } from '@wip/client'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// FileFieldInput — drag-drop + file picker that uploads to WIP and stores
// the returned file_id in the form state.
//
// PoNIF: abandoning the form leaves orphan files in storage. That's a
// known limitation — tracked in KNOWN_ISSUES. Cleanup is manual via the
// Files page (reference_count == 0 candidates).
// ---------------------------------------------------------------------------

export interface FileFieldInputProps {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}

export default function FileFieldInput({ field, value, onChange, disabled }: FileFieldInputProps) {
  const fileId = typeof value === 'string' ? value : ''
  const { data: existing } = useFile(fileId, { enabled: !!fileId })
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useUploadFile({
    onSuccess: (fileEntity) => {
      onChange(fileEntity.file_id)
      setUploadError(null)
    },
    onError: (err) => setUploadError(err.message),
  })

  const cfg = field.file_config
  const acceptAttr = cfg?.allowed_types?.join(',') || undefined
  const maxSizeBytes = cfg?.max_size_mb ? cfg.max_size_mb * 1024 * 1024 : undefined

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]!
    setUploadError(null)
    if (maxSizeBytes && file.size > maxSizeBytes) {
      setUploadError(`File exceeds ${cfg?.max_size_mb} MB limit`)
      return
    }
    if (cfg?.allowed_types?.length && !cfg.allowed_types.includes(file.type)) {
      setUploadError(`File type ${file.type} not allowed`)
      return
    }
    upload.mutate({ file, filename: file.name })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    handleFiles(e.dataTransfer.files)
  }

  const handleRemove = () => {
    onChange(null)
    setUploadError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      {fileId ? (
        <div className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
          <FileIcon size={16} className="text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-800 truncate">
              {existing?.filename || fileId}
            </div>
            <div className="text-[10px] text-gray-400">
              {existing?.size_bytes != null && formatBytes(existing.size_bytes)}
              {existing?.content_type && ` · ${existing.content_type}`}
              {' · '}
              <span className="font-mono">{fileId.slice(0, 8)}…</span>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="p-1 text-gray-400 hover:text-red-500"
              title="Remove file (doesn't delete)"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-md px-3 py-4 text-center transition-colors',
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
        >
          {upload.isPending ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              Uploading...
            </div>
          ) : (
            <>
              <Upload size={18} className="text-gray-300 mx-auto mb-1" />
              <div className="text-xs text-gray-500">
                Drag & drop a file here, or{' '}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled}
                  className="text-blue-500 hover:text-blue-700 underline"
                >
                  choose a file
                </button>
              </div>
              {cfg && (
                <div className="text-[10px] text-gray-400 mt-1">
                  {cfg.allowed_types?.length
                    ? cfg.allowed_types.join(', ')
                    : 'Any type'}
                  {cfg.max_size_mb != null && ` · max ${cfg.max_size_mb} MB`}
                </div>
              )}
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={acceptAttr}
            disabled={disabled}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
        </div>
      )}
      {uploadError && (
        <div className="text-xs text-red-500 mt-1">{uploadError}</div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
