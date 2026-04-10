import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderTree,
  Plus,
  ChevronDown,
  ChevronRight,
  BookOpen,
  FileCode2,
  FileText,
  Settings2,
  RefreshCw,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useNamespaces, useWipClient, useCreateNamespace, useUpdateNamespace, useDeleteNamespace } from '@wip/react'
import type { Namespace } from '@wip/client'
import { useQuery } from '@tanstack/react-query'
import StatusBadge from '@/components/common/StatusBadge'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import JsonViewer from '@/components/common/JsonViewer'

// ---------------------------------------------------------------------------
// Namespace Stats Hook (per-namespace detail)
// ---------------------------------------------------------------------------

function useNamespaceDetail(prefix: string | null) {
  const client = useWipClient()
  return useQuery({
    queryKey: ['rc-console', 'ns-detail', prefix],
    queryFn: async () => {
      if (!prefix) return null
      const stats = await client.registry.getNamespaceStats(prefix)
      return stats
    },
    enabled: !!prefix,
    staleTime: 60_000,
  })
}

// ---------------------------------------------------------------------------
// Create Namespace Dialog (inline)
// ---------------------------------------------------------------------------

function CreateNamespaceForm({ onClose }: { onClose: () => void }) {
  const [prefix, setPrefix] = useState('')
  const [description, setDescription] = useState('')
  const [isolationMode, setIsolationMode] = useState<'open' | 'strict'>('open')
  const [deletionMode, setDeletionMode] = useState<'retain' | 'full'>('retain')
  const [showIdConfig, setShowIdConfig] = useState(false)
  const [idAlgorithm, setIdAlgorithm] = useState<'uuid7' | 'prefixed' | 'nanoid'>('uuid7')
  const [idPrefix, setIdPrefix] = useState('')
  const [idLength, setIdLength] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const create = useCreateNamespace({
    onSuccess: () => onClose(),
    onError: (err: Error) => setError(err.message),
  })

  const handleCreate = () => {
    const trimmedPrefix = prefix.trim().toLowerCase()
    if (!trimmedPrefix) { setError('Prefix is required'); return }
    if (!/^[a-z][a-z0-9-]*$/.test(trimmedPrefix)) {
      setError('Prefix must start with a letter and contain only lowercase letters, numbers, and hyphens')
      return
    }
    const idConfig = showIdConfig && idAlgorithm !== 'uuid7' ? {
      default: {
        algorithm: idAlgorithm,
        ...(idPrefix ? { prefix: idPrefix } : {}),
        ...(idLength ? { length: idLength } : {}),
      },
    } : undefined
    create.mutate({
      prefix: trimmedPrefix,
      description: description.trim() || undefined,
      isolation_mode: isolationMode,
      deletion_mode: deletionMode,
      id_config: idConfig,
    })
  }

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Create Namespace</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Prefix *</label>
          <input
            type="text"
            value={prefix}
            onChange={e => { setPrefix(e.target.value); setError(null) }}
            placeholder="my-namespace"
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            autoFocus
          />
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
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Isolation Mode</label>
            <select
              value={isolationMode}
              onChange={e => setIsolationMode(e.target.value as 'open' | 'strict')}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="open">open</option>
              <option value="strict">strict</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Deletion Mode</label>
            <select
              value={deletionMode}
              onChange={e => setDeletionMode(e.target.value as 'retain' | 'full')}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="retain">retain</option>
              <option value="full">full</option>
            </select>
          </div>
        </div>
        {/* ID Configuration (optional) */}
        <div>
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={showIdConfig} onChange={e => setShowIdConfig(e.target.checked)} className="rounded border-gray-300" />
            Custom ID generation
          </label>
          {showIdConfig && (
            <div className="mt-2 flex items-center gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Algorithm</label>
                <select
                  value={idAlgorithm}
                  onChange={e => setIdAlgorithm(e.target.value as 'uuid7' | 'prefixed' | 'nanoid')}
                  className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                >
                  <option value="uuid7">UUID7 (default)</option>
                  <option value="prefixed">Prefixed Sequential</option>
                  <option value="nanoid">NanoID</option>
                </select>
              </div>
              {idAlgorithm === 'prefixed' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Prefix</label>
                  <input
                    type="text"
                    value={idPrefix}
                    onChange={e => setIdPrefix(e.target.value)}
                    placeholder="e.g. DOC-"
                    className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-32 focus:outline-none focus:border-blue-400"
                  />
                </div>
              )}
              {idAlgorithm === 'nanoid' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Length</label>
                  <input
                    type="number"
                    value={idLength ?? ''}
                    onChange={e => setIdLength(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="21"
                    className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-20 focus:outline-none focus:border-blue-400"
                  />
                </div>
              )}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            disabled={create.isPending || !prefix.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {create.isPending ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Namespace Row (expandable)
// ---------------------------------------------------------------------------

function NamespaceRow({
  ns,
  isExpanded,
  onToggle,
}: {
  ns: Namespace
  isExpanded: boolean
  onToggle: () => void
}) {
  const client = useWipClient()
  const { data: stats } = useNamespaceDetail(isExpanded ? ns.prefix : null)

  const [editing, setEditing] = useState(false)
  const [editDesc, setEditDesc] = useState(ns.description ?? '')
  const [editIsolation, setEditIsolation] = useState(ns.isolation_mode ?? 'open')
  const [editDeletionMode, setEditDeletionMode] = useState(ns.deletion_mode ?? 'retain')
  // Delete states: false → 'confirm' → 'confirm-retain' (second gate for protected namespaces)
  const [deleteStep, setDeleteStep] = useState<false | 'confirm' | 'confirm-retain'>(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const update = useUpdateNamespace({
    onSuccess: () => { setEditing(false) },
  })

  const remove = useDeleteNamespace({
    onSuccess: () => { setDeleteStep(false); setDeleting(false) },
    onError: (err: Error) => { setDeleteError(err.message); setDeleting(false) },
  })

  const handleDeleteClick = () => {
    setDeleteError(null)
    if (ns.deletion_mode === 'full') {
      setDeleteStep('confirm')
    } else {
      setDeleteStep('confirm')
    }
  }

  const handleDeleteConfirm = () => {
    // If retain, require second confirmation
    if (ns.deletion_mode !== 'full' && deleteStep === 'confirm') {
      setDeleteStep('confirm-retain')
      return
    }
    // Actually delete
    performDelete()
  }

  const performDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      if (ns.deletion_mode !== 'full') {
        await client.registry.updateNamespace(ns.prefix, { deletion_mode: 'full' })
      }
      remove.mutate({ prefix: ns.prefix, deletedBy: 'rc-console' })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to prepare namespace for deletion')
      setDeleting(false)
    }
  }

  const startEdit = () => {
    setEditDesc(ns.description ?? '')
    setEditIsolation(ns.isolation_mode ?? 'open')
    setEditDeletionMode(ns.deletion_mode ?? 'retain')
    update.reset()
    setEditing(true)
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        {isExpanded
          ? <ChevronDown size={14} className="text-gray-400" />
          : <ChevronRight size={14} className="text-gray-400" />
        }
        <FolderTree size={16} className="text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-800">{ns.prefix}</span>
          {ns.description && (
            <span className="text-xs text-gray-400 ml-2">{ns.description}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {ns.isolation_mode && (
            <span className="text-xs text-gray-400">{ns.isolation_mode}</span>
          )}
          {ns.status && (
            <StatusBadge status={ns.status === 'active' ? 'active' : 'inactive'} label={ns.status} />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 pl-12 space-y-3">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <Link
                to={`/terminologies?ns=${ns.prefix}`}
                className="bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <BookOpen size={12} />
                  Terminologies
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-0.5">
                  {(stats.entity_counts.terminologies ?? 0).toLocaleString()}
                </div>
              </Link>
              <Link
                to={`/templates?ns=${ns.prefix}`}
                className="bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <FileCode2 size={12} />
                  Templates
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-0.5">
                  {(stats.entity_counts.templates ?? 0).toLocaleString()}
                </div>
              </Link>
              <Link
                to={`/documents?ns=${ns.prefix}`}
                className="bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <FileText size={12} />
                  Documents
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-0.5">
                  {(stats.entity_counts.documents ?? 0).toLocaleString()}
                </div>
              </Link>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center flex-wrap gap-4 text-xs text-gray-400">
            {ns.isolation_mode && (
              <span className="flex items-center gap-1">
                <Settings2 size={10} />
                Isolation: {ns.isolation_mode}
              </span>
            )}
            <span>Deletion: {ns.deletion_mode ?? 'retain'}</span>
            {ns.created_at && (
              <span>Created: {new Date(ns.created_at).toLocaleDateString()}</span>
            )}
            {ns.created_by && (
              <span>By: {ns.created_by}</span>
            )}
            {ns.updated_at && (
              <span>Updated: {new Date(ns.updated_at).toLocaleDateString()}</span>
            )}
            {ns.updated_by && (
              <span>By: {ns.updated_by}</span>
            )}
          </div>

          {/* ID Config */}
          {(() => {
            const idConfig = ns.id_config
            if (!idConfig || Object.keys(idConfig).length === 0) return null
            return (
              <details className="group">
                <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600">
                  ID Config ({Object.keys(idConfig).length} entity types)
                </summary>
                <div className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(idConfig).map(([entity, config]) => (
                    <div key={entity} className="bg-gray-50 rounded px-2 py-1 text-xs">
                      <span className="font-medium text-gray-600">{entity}:</span>{' '}
                      <span className="text-gray-400 font-mono">{JSON.stringify(config)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )
          })()}

          {/* Allowed External Refs */}
          {(() => {
            const refs = ns.allowed_external_refs
            if (!refs?.length) return null
            return (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>External refs:</span>
                {refs.map(r => (
                  <span key={r} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{r}</span>
                ))}
              </div>
            )
          })()}

          {/* Raw JSON */}
          <details className="group">
            <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600">
              Raw JSON
            </summary>
            <div className="mt-2">
              <JsonViewer data={{ ...ns, stats }} maxHeight="300px" collapsed />
            </div>
          </details>

          {/* Edit form */}
          {editing ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Isolation Mode</label>
                  <select
                    value={editIsolation}
                    onChange={e => setEditIsolation(e.target.value as 'open' | 'strict')}
                    className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  >
                    <option value="open">open</option>
                    <option value="strict">strict</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Deletion Mode</label>
                  <select
                    value={editDeletionMode}
                    onChange={e => setEditDeletionMode(e.target.value as 'retain' | 'full')}
                    className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  >
                    <option value="retain">retain</option>
                    <option value="full">full</option>
                  </select>
                </div>
              </div>
              {update.error && <p className="text-xs text-red-500">{update.error.message}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => update.mutate({ prefix: ns.prefix, data: { description: editDesc.trim() || undefined, isolation_mode: editIsolation as 'open' | 'strict', deletion_mode: editDeletionMode as 'retain' | 'full' } })}
                  disabled={update.isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {update.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : deleteStep === 'confirm' ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-red-700">
                Delete namespace <strong>{ns.prefix}</strong>? This will remove all terminologies, templates, and documents in this namespace.
              </p>
              {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setDeleteStep(false)}
                  className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : deleteStep === 'confirm-retain' ? (
            <div className="bg-red-100 border-2 border-red-300 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-red-800">
                This namespace is protected (deletion mode: retain).
              </p>
              <p className="text-sm text-red-700">
                Deleting <strong>{ns.prefix}</strong> will permanently remove all its data. This protection exists because the namespace was marked as non-deletable. Are you absolutely sure?
              </p>
              {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={performDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-red-700 text-white text-sm font-medium rounded-md hover:bg-red-800 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, permanently delete'}
                </button>
                <button
                  onClick={() => setDeleteStep(false)}
                  className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={12} />
                Edit
              </button>
              <button
                onClick={handleDeleteClick}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Namespaces Page
// ---------------------------------------------------------------------------

export default function NamespacesPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [expandedNs, setExpandedNs] = useState<string | null>(null)
  const { data: namespaces, isLoading, error, refetch } = useNamespaces()

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Namespaces</h1>
          <p className="text-sm text-gray-400 mt-1">Browse and manage namespaces</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 border border-gray-200 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowCreate(s => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            <Plus size={14} />
            Create
          </button>
        </div>
      </div>

      {showCreate && <CreateNamespaceForm onClose={() => setShowCreate(false)} />}

      {isLoading && <LoadingState label="Loading namespaces..." />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {namespaces && (
        <div className="bg-white border border-gray-200 rounded-lg">
          {namespaces.length === 0 ? (
            <p className="text-sm text-gray-400 p-6 text-center">No namespaces found.</p>
          ) : (
            namespaces.map(ns => (
                <NamespaceRow
                  key={ns.prefix}
                  ns={ns}
                  isExpanded={expandedNs === ns.prefix}
                  onToggle={() => setExpandedNs(prev => prev === ns.prefix ? null : ns.prefix)}
                />
              ))
          )}
        </div>
      )}

      {namespaces && (
        <p className="text-xs text-gray-400">
          {namespaces.length} namespace{namespaces.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
