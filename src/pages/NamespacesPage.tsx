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
} from 'lucide-react'
import { useNamespaces, useWipClient } from '@wip/react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { wipKeys } from '@wip/react'
import StatusBadge from '@/components/common/StatusBadge'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/cn'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'

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
  const client = useWipClient()
  const queryClient = useQueryClient()
  const [prefix, setPrefix] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const trimmedPrefix = prefix.trim().toLowerCase()
      if (!trimmedPrefix) throw new Error('Prefix is required')
      if (!/^[a-z][a-z0-9-]*$/.test(trimmedPrefix)) {
        throw new Error('Prefix must start with a letter and contain only lowercase letters, numbers, and hyphens')
      }
      return client.registry.createNamespace({
        prefix: trimmedPrefix,
        description: description.trim() || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wipKeys.registry.namespaces() })
      onClose()
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

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
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={() => create.mutate()}
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
  ns: { prefix: string; description?: string; status?: string; isolation_mode?: string; created_at?: string }
  isExpanded: boolean
  onToggle: () => void
}) {
  const { setNamespace } = useNamespaceFilter()
  const { data: stats } = useNamespaceDetail(isExpanded ? ns.prefix : null)

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
                to="/terminologies"
                onClick={() => setNamespace(ns.prefix)}
                className="bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <BookOpen size={12} />
                  Terminologies
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-0.5">
                  {(stats.terminologies ?? 0).toLocaleString()}
                </div>
              </Link>
              <Link
                to="/templates"
                onClick={() => setNamespace(ns.prefix)}
                className="bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <FileCode2 size={12} />
                  Templates
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-0.5">
                  {(stats.templates ?? 0).toLocaleString()}
                </div>
              </Link>
              <Link
                to="/documents"
                onClick={() => setNamespace(ns.prefix)}
                className="bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <FileText size={12} />
                  Documents
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-0.5">
                  {(stats.documents ?? 0).toLocaleString()}
                </div>
              </Link>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            {ns.isolation_mode && (
              <span className="flex items-center gap-1">
                <Settings2 size={10} />
                Isolation: {ns.isolation_mode}
              </span>
            )}
            {ns.created_at && (
              <span>Created: {new Date(ns.created_at).toLocaleDateString()}</span>
            )}
          </div>
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
            namespaces
              .filter(ns => ns.prefix !== 'ptest')
              .map(ns => (
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
          {namespaces.filter(ns => ns.prefix !== 'ptest').length} namespace{namespaces.filter(ns => ns.prefix !== 'ptest').length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
