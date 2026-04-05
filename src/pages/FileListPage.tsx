import { useState } from 'react'
import { FileIcon, Calendar, Hash, RefreshCw, HardDrive } from 'lucide-react'
import { useFiles } from '@wip/react'
import Pagination from '@/components/common/Pagination'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'

export default function FileListPage() {
  const { namespace } = useNamespaceFilter()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<'active' | 'inactive' | ''>('active')
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

      {isLoading && <LoadingState label="Loading files..." />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">No files found.</p>
            ) : (
              items.map(f => (
                <div key={f.file_id} className="flex items-center gap-3 px-4 py-3">
                  <FileIcon size={16} className="text-gray-400 shrink-0" />
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
                    {f.uploaded_at && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(f.uploaded_at).toLocaleDateString()}
                      </span>
                    )}
                    <StatusBadge status={f.status === 'active' ? 'active' : 'inactive'} label={f.status} />
                  </div>
                </div>
              ))
            )}
          </div>
          <Pagination page={page} totalPages={data.pages ?? 1} onPageChange={setPage} />
          <p className="text-xs text-gray-400">{data.total ?? 0} file{(data.total ?? 0) !== 1 ? 's' : ''}</p>
        </>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
