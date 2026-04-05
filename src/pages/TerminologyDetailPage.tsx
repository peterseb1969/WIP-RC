import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  ArrowLeft,
  Hash,
  Tag,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import {
  useTerminology,
  useTerms,
  useUpdateTerminology,
  useDeleteTerminology,
  useCreateTerm,
  useUpdateTerm,
  useDeleteTerm,
  useDeprecateTerm,
} from '@wip/react'
import type { Term } from '@wip/client'
import SearchInput from '@/components/common/SearchInput'
import Pagination from '@/components/common/Pagination'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'

// ---------------------------------------------------------------------------
// Create Term Form (inline)
// ---------------------------------------------------------------------------

function CreateTermForm({
  terminologyId,
  onClose,
}: {
  terminologyId: string
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [aliases, setAliases] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useCreateTerm(terminologyId, {
    onSuccess: () => onClose(),
    onError: (err: Error) => setError(err.message),
  })

  const handleCreate = () => {
    const v = value.trim()
    if (!v) { setError('Value is required'); return }
    create.mutate({
      value: v,
      label: label.trim() || undefined,
      description: description.trim() || undefined,
      aliases: aliases.trim() ? aliases.split(',').map(a => a.trim()).filter(Boolean) : undefined,
      created_by: 'rc-console',
    })
  }

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-4 mb-3">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Add Term</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Value *</label>
            <input
              type="text"
              value={value}
              onChange={e => { setValue(e.target.value); setError(null) }}
              placeholder="term_value"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-blue-400"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Display label"
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
          <label className="block text-xs text-gray-500 mb-1">Aliases (comma-separated)</label>
          <input
            type="text"
            value={aliases}
            onChange={e => setAliases(e.target.value)}
            placeholder="alias1, alias2"
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            disabled={create.isPending || !value.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {create.isPending ? 'Adding...' : 'Add Term'}
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
// Term Row (with edit/delete)
// ---------------------------------------------------------------------------

function TermRow({
  term,
  terminologyId,
}: {
  term: Term
  terminologyId: string
}) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(term.value)
  const [editLabel, setEditLabel] = useState(term.label ?? '')
  const [editDesc, setEditDesc] = useState(term.description ?? '')
  const [editAliases, setEditAliases] = useState(term.aliases?.join(', ') ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showDeprecate, setShowDeprecate] = useState(false)
  const [deprecateReason, setDeprecateReason] = useState('')

  const update = useUpdateTerm({
    onSuccess: () => setEditing(false),
  })
  const remove = useDeleteTerm(terminologyId, {
    onSuccess: () => setConfirmDelete(false),
  })
  const deprecate = useDeprecateTerm({
    onSuccess: () => setShowDeprecate(false),
  })

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(term.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const startEdit = () => {
    setEditValue(term.value)
    setEditLabel(term.label ?? '')
    setEditDesc(term.description ?? '')
    setEditAliases(term.aliases?.join(', ') ?? '')
    setEditing(true)
    setConfirmDelete(false)
    setShowDeprecate(false)
  }

  const handleSave = () => {
    update.mutate({
      termId: term.term_id,
      data: {
        value: editValue.trim() || undefined,
        label: editLabel.trim() || undefined,
        description: editDesc.trim() || undefined,
        aliases: editAliases.trim() ? editAliases.split(',').map(a => a.trim()).filter(Boolean) : [],
        updated_by: 'rc-console',
      },
    })
  }

  if (editing) {
    return (
      <div className="px-4 py-3 bg-gray-50 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Value</label>
            <input
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-400"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Label</label>
            <input
              type="text"
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Description</label>
          <input
            type="text"
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Aliases (comma-separated)</label>
          <input
            type="text"
            value={editAliases}
            onChange={e => setEditAliases(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        {update.error && <p className="text-xs text-red-500">{update.error.message}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {update.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-2.5 py-1 border border-gray-200 text-xs rounded-md text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
      <Tag size={14} className="text-gray-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{term.label ?? term.value}</span>
          <button
            onClick={handleCopy}
            className="text-gray-300 hover:text-gray-500"
            title="Copy value"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-mono text-gray-400">{term.value}</span>
          {term.aliases && term.aliases.length > 0 && (
            <span className="text-xs text-gray-300">
              aliases: {term.aliases.join(', ')}
            </span>
          )}
        </div>
        {term.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{term.description}</p>
        )}
        {/* Inline deprecate form */}
        {showDeprecate && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={deprecateReason}
              onChange={e => setDeprecateReason(e.target.value)}
              placeholder="Deprecation reason"
              className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-blue-400 flex-1 max-w-xs"
              autoFocus
            />
            <button
              onClick={() => deprecate.mutate({ termId: term.term_id, data: { reason: deprecateReason.trim() || 'Deprecated' } })}
              disabled={deprecate.isPending}
              className="px-2 py-1 bg-amber-500 text-white text-xs rounded-md hover:bg-amber-600 disabled:opacity-50"
            >
              {deprecate.isPending ? '...' : 'Deprecate'}
            </button>
            <button
              onClick={() => setShowDeprecate(false)}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}
        {/* Inline delete confirmation */}
        {confirmDelete && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-red-600">Delete this term?</span>
            <button
              onClick={() => remove.mutate(term.term_id)}
              disabled={remove.isPending}
              className="px-2 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {remove.isPending ? '...' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge
          status={term.status === 'active' ? 'active' : term.status === 'deprecated' ? 'warning' : 'inactive'}
          label={term.status}
        />
        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={startEdit} className="p-1 text-gray-300 hover:text-blue-500" title="Edit">
            <Pencil size={12} />
          </button>
          {term.status === 'active' && (
            <button onClick={() => { setShowDeprecate(true); setConfirmDelete(false) }} className="p-1 text-gray-300 hover:text-amber-500" title="Deprecate">
              <AlertTriangle size={12} />
            </button>
          )}
          <button onClick={() => { setConfirmDelete(true); setShowDeprecate(false) }} className="p-1 text-gray-300 hover:text-red-500" title="Delete">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Terminology Detail Page
// ---------------------------------------------------------------------------

export default function TerminologyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'deprecated' | ''>('active')
  const [showCreateTerm, setShowCreateTerm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Edit form state
  const [editLabel, setEditLabel] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCaseSensitive, setEditCaseSensitive] = useState(false)
  const [editExtensible, setEditExtensible] = useState(true)

  const { data: terminology, isLoading: termLoading, error: termError } = useTerminology(id ?? '')
  const { data: termsData, isLoading: termsLoading, error: termsError, refetch } = useTerms(id ?? '', {
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    page_size: 50,
  })

  const updateTerminology = useUpdateTerminology({
    onSuccess: () => setEditing(false),
  })
  const deleteTerminology = useDeleteTerminology({
    onSuccess: () => navigate('/terminologies'),
  })

  const startEdit = () => {
    if (!terminology) return
    setEditLabel(terminology.label)
    setEditDesc(terminology.description ?? '')
    setEditCaseSensitive(terminology.case_sensitive)
    setEditExtensible(terminology.extensible)
    setEditing(true)
    setConfirmDelete(false)
  }

  const handleSave = () => {
    if (!terminology) return
    updateTerminology.mutate({
      id: terminology.terminology_id,
      data: {
        label: editLabel.trim() || undefined,
        description: editDesc.trim() || undefined,
        case_sensitive: editCaseSensitive,
        extensible: editExtensible,
        updated_by: 'rc-console',
      },
    })
  }

  if (termLoading) return <LoadingState label="Loading terminology..." />
  if (termError) return <ErrorState message={termError.message} />
  if (!terminology) return <ErrorState message="Terminology not found" />

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          to="/terminologies"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 mb-2"
        >
          <ArrowLeft size={12} />
          Back to Terminologies
        </Link>
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-blue-500" />
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-800">
              {terminology.label || terminology.value}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-mono text-gray-400">{terminology.value}</span>
              {terminology.namespace && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {terminology.namespace}
                </span>
              )}
              <StatusBadge
                status={terminology.status === 'active' ? 'active' : 'inactive'}
                label={terminology.status}
              />
            </div>
          </div>
          {/* Edit/Delete buttons */}
          {!editing && !confirmDelete && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={12} />
                Edit
              </button>
              <button
                onClick={() => { setConfirmDelete(true); setEditing(false) }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          )}
        </div>
        {terminology.description && !editing && (
          <p className="text-sm text-gray-500 mt-2">{terminology.description}</p>
        )}
      </div>

      {/* Edit terminology form */}
      {editing && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Edit Terminology</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Label</label>
              <input
                type="text"
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={editCaseSensitive}
                  onChange={e => setEditCaseSensitive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Case sensitive
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={editExtensible}
                  onChange={e => setEditExtensible(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Extensible
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input
              type="text"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          {updateTerminology.error && <p className="text-xs text-red-500">{updateTerminology.error.message}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={updateTerminology.isPending}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {updateTerminology.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
          <p className="text-sm text-red-700">
            Delete terminology <strong>{terminology.label || terminology.value}</strong>?
            {(terminology.term_count ?? 0) > 0 && (
              <span className="block mt-1">
                This terminology has <strong>{terminology.term_count}</strong> terms. Deleting it will remove all terms.
              </span>
            )}
          </p>
          {deleteTerminology.error && <p className="text-xs text-red-500">{deleteTerminology.error.message}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={() => deleteTerminology.mutate(terminology.terminology_id)}
              disabled={deleteTerminology.isPending}
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {deleteTerminology.isPending ? 'Deleting...' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-6 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Hash size={10} />
          ID: {terminology.terminology_id}
        </span>
        {terminology.term_count !== undefined && (
          <span>{terminology.term_count} terms</span>
        )}
        <span>{terminology.case_sensitive ? 'Case sensitive' : 'Case insensitive'}</span>
        <span>{terminology.extensible ? 'Extensible' : 'Fixed'}</span>
        <span>{terminology.mutable ? 'Mutable' : 'Immutable'}</span>
        {terminology.created_at && (
          <span>Created: {new Date(terminology.created_at).toLocaleDateString()}</span>
        )}
      </div>

      {/* Terms Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Terms</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-1.5 text-gray-400 hover:text-gray-600"
              title="Refresh terms"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowCreateTerm(s => !s)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
            >
              <Plus size={12} />
              Add Term
            </button>
          </div>
        </div>

        {showCreateTerm && (
          <CreateTermForm
            terminologyId={terminology.terminology_id}
            onClose={() => setShowCreateTerm(false)}
          />
        )}

        {/* Filters */}
        <div className="flex items-center gap-3">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Search terms..."
            className="flex-1 max-w-sm"
          />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deprecated">Deprecated</option>
            <option value="">All</option>
          </select>
        </div>

        {/* Term list */}
        {termsLoading && <LoadingState label="Loading terms..." />}
        {termsError && <ErrorState message={termsError.message} onRetry={() => refetch()} />}

        {termsData && (
          <>
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {(termsData.items ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 p-6 text-center">No terms found.</p>
              ) : (
                (termsData.items ?? []).map(term => (
                  <TermRow
                    key={term.term_id}
                    term={term}
                    terminologyId={terminology.terminology_id}
                  />
                ))
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {termsData.total ?? 0} term{(termsData.total ?? 0) !== 1 ? 's' : ''} total
              </p>
              <Pagination
                page={page}
                totalPages={termsData.pages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
