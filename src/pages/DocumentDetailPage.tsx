import { useParams, Link } from 'react-router-dom'
import {
  FileText,
  ArrowLeft,
  Hash,
  Layers,
  Calendar,
  User,
  Clock,
} from 'lucide-react'
import { useDocument, useDocumentVersions } from '@wip/react'
import JsonViewer from '@/components/common/JsonViewer'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/cn'

export default function DocumentDetailPage() {
  const { templateValue, id } = useParams()
  const { data: doc, isLoading, error } = useDocument(id ?? '')
  const { data: versions } = useDocumentVersions(id ?? '')

  if (isLoading) return <LoadingState label="Loading document..." />
  if (error) return <ErrorState message={error.message} />
  if (!doc) return <ErrorState message="Document not found" />

  const docData = (doc.data ?? {}) as Record<string, unknown>

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          to="/documents"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 mb-2"
        >
          <ArrowLeft size={12} />
          Back to Documents
        </Link>
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-gray-400" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">
              {doc.document_id}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {templateValue && (
                <Link
                  to={`/templates?search=${templateValue}`}
                  className="text-xs font-mono text-indigo-400 hover:text-indigo-600"
                >
                  {templateValue}
                </Link>
              )}
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Layers size={10} /> v{doc.version ?? 1}
              </span>
              <StatusBadge status={doc.status === 'active' ? 'active' : 'inactive'} label={doc.status} />
            </div>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Hash size={10} /> {doc.document_id}
        </span>
        {doc.template_id && (
          <span>Template: {doc.template_id}</span>
        )}
        {doc.namespace && (
          <span className="bg-gray-100 px-1.5 py-0.5 rounded">{doc.namespace}</span>
        )}
        {doc.created_at && (
          <span className="flex items-center gap-1">
            <Calendar size={10} /> Created: {new Date(doc.created_at).toLocaleDateString()}
          </span>
        )}
        {doc.updated_at && (
          <span className="flex items-center gap-1">
            <Clock size={10} /> Updated: {new Date(doc.updated_at).toLocaleDateString()}
          </span>
        )}
        {doc.created_by && (
          <span className="flex items-center gap-1">
            <User size={10} /> {doc.created_by}
          </span>
        )}
      </div>

      {/* Data fields */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Data</h2>
        {Object.keys(docData).length === 0 ? (
          <p className="text-sm text-gray-400">No data fields.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {Object.entries(docData).map(([key, val]) => (
              <div key={key} className="flex items-start gap-3 px-4 py-2.5">
                <span className="text-sm font-mono text-gray-500 shrink-0 min-w-[120px]">{key}</span>
                <div className="text-sm text-gray-800 break-all">
                  {typeof val === 'object' && val !== null ? (
                    <JsonViewer data={val} maxHeight="200px" collapsed />
                  ) : (
                    formatFieldValue(val)
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raw JSON */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Raw Document</h2>
        <JsonViewer data={doc} maxHeight="400px" collapsed />
      </div>

      {/* Version History */}
      {versions && (versions as Record<string, unknown>[]).length > 1 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Version History ({(versions as Record<string, unknown>[]).length} versions)
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {(versions as Record<string, unknown>[]).map((v, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5',
                  v.version === doc.version && 'bg-blue-50/50'
                )}
              >
                <Layers size={14} className="text-gray-300" />
                <span className="text-sm font-medium text-gray-700">Version {String(v.version)}</span>
                {v.version === doc.version && (
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">current</span>
                )}
                {v.created_at && (
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(String(v.created_at)).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  return String(val)
}
