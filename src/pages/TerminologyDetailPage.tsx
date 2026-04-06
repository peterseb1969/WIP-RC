import { useState, useRef } from 'react'
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
  Code,
  Download,
  Upload,
  CheckCircle,
  XCircle,
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
  useWipClient,
} from '@wip/react'
import type { Term } from '@wip/client'

import SearchInput from '@/components/common/SearchInput'
import Pagination from '@/components/common/Pagination'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import JsonViewer from '@/components/common/JsonViewer'

// ---------------------------------------------------------------------------
// Create Term Form (inline)
// ---------------------------------------------------------------------------

function CreateTermForm({
  terminologyId,
  namespace,
  existingTerms,
  onClose,
}: {
  terminologyId: string
  namespace: string
  existingTerms: Term[]
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [aliases, setAliases] = useState('')
  const [sortOrder, setSortOrder] = useState('')
  const [parentTermId, setParentTermId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useCreateTerm(terminologyId, namespace, {
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
      sort_order: sortOrder.trim() ? parseInt(sortOrder, 10) : undefined,
      parent_term_id: parentTermId || undefined,
      created_by: 'rc-console',
    })
  }

  const activeTerms = existingTerms.filter(t => t.status === 'active')

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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Parent Term</label>
            <select
              value={parentTermId}
              onChange={e => setParentTermId(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="">None</option>
              {activeTerms.map(t => (
                <option key={t.term_id} value={t.term_id}>{t.label || t.value}</option>
              ))}
            </select>
          </div>
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
  allTerms,
}: {
  term: Term
  terminologyId: string
  allTerms: Term[]
}) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(term.value)
  const [editLabel, setEditLabel] = useState(term.label ?? '')
  const [editDesc, setEditDesc] = useState(term.description ?? '')
  const [editAliases, setEditAliases] = useState(term.aliases?.join(', ') ?? '')
  const [editSortOrder, setEditSortOrder] = useState(String(term.sort_order ?? ''))
  const [editParentTermId, setEditParentTermId] = useState(term.parent_term_id ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showDeprecate, setShowDeprecate] = useState(false)
  const [deprecateReason, setDeprecateReason] = useState('')
  const [deprecateReplacedBy, setDeprecateReplacedBy] = useState('')
  const [showJson, setShowJson] = useState(false)

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
    setEditSortOrder(String(term.sort_order ?? ''))
    setEditParentTermId(term.parent_term_id ?? '')
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
        sort_order: editSortOrder.trim() ? parseInt(editSortOrder, 10) : undefined,
        parent_term_id: editParentTermId || undefined,
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Sort Order</label>
            <input
              type="number"
              value={editSortOrder}
              onChange={e => setEditSortOrder(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Parent Term</label>
            <select
              value={editParentTermId}
              onChange={e => setEditParentTermId(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="">None</option>
              {allTerms.filter(t => t.term_id !== term.term_id && t.status === 'active').map(t => (
                <option key={t.term_id} value={t.term_id}>{t.label || t.value}</option>
              ))}
            </select>
          </div>
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
    <div className="group">
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
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
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
            <span className="text-xs font-mono text-gray-400">{term.value}</span>
            {term.aliases && term.aliases.length > 0 && (
              <span className="text-xs text-gray-300">
                aliases: {term.aliases.join(', ')}
              </span>
            )}
            {term.sort_order != null && term.sort_order !== 0 && (
              <span className="text-xs text-gray-300">order: {term.sort_order}</span>
            )}
            {term.parent_term_id && (() => {
              const parent = allTerms.find(t => t.term_id === term.parent_term_id)
              return (
                <span className="text-xs text-gray-300">
                  parent: {parent ? (parent.label || parent.value) : term.parent_term_id}
                </span>
              )
            })()}
          </div>
          {term.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{term.description}</p>
          )}
          {term.status === 'deprecated' && (
            <div className="flex items-center gap-2 mt-0.5 text-xs text-amber-500">
              {term.deprecated_reason && (
                <span>Reason: {term.deprecated_reason}</span>
              )}
              {term.replaced_by_term_id && (() => {
                const replacement = allTerms.find(t => t.term_id === term.replaced_by_term_id)
                return (
                  <span>Replaced by: {replacement ? (replacement.label || replacement.value) : term.replaced_by_term_id}</span>
                )
              })()}
            </div>
          )}
          {/* Inline deprecate form */}
          {showDeprecate && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={deprecateReason}
                  onChange={e => setDeprecateReason(e.target.value)}
                  placeholder="Deprecation reason"
                  className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-blue-400 flex-1 max-w-xs"
                  autoFocus
                />
                <select
                  value={deprecateReplacedBy}
                  onChange={e => setDeprecateReplacedBy(e.target.value)}
                  className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-blue-400 max-w-xs"
                >
                  <option value="">Replaced by... (optional)</option>
                  {allTerms.filter(t => t.term_id !== term.term_id && t.status === 'active').map(t => (
                    <option key={t.term_id} value={t.term_id}>{t.label || t.value}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => deprecate.mutate({ termId: term.term_id, data: { reason: deprecateReason.trim() || 'Deprecated', replaced_by_term_id: deprecateReplacedBy || undefined } })}
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
            <button onClick={() => setShowJson(s => !s)} className={`p-1 ${showJson ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500'}`} title="Raw JSON">
              <Code size={12} />
            </button>
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
      {showJson && (
        <div className="px-4 pb-3 pl-10">
          <JsonViewer data={term} maxHeight="200px" collapsed />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Validate Panel
// ---------------------------------------------------------------------------

function ValidatePanel({ terminologyId, terminologyValue }: { terminologyId: string; terminologyValue: string }) {
  const client = useWipClient()
  const [input, setInput] = useState('')
  const [results, setResults] = useState<Array<{ value: string; valid: boolean; matched_term_id?: string; matched_value?: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleValidate = async () => {
    const values = input.split('\n').map(v => v.trim()).filter(Boolean)
    if (values.length === 0) return
    setLoading(true)
    setError(null)
    try {
      if (values.length === 1) {
        const val = values[0]!
        const res = await client.defStore.validateValue({
          terminology_id: terminologyId,
          value: val,
        })
        setResults([{ value: val, valid: res.valid, matched_term_id: res.matched_term?.term_id, matched_value: res.matched_term?.value }])
      } else {
        const res = await client.defStore.bulkValidate({
          items: values.map(v => ({ terminology_id: terminologyId, value: v })),
        })
        setResults(res.results.map((r, i) => ({
          value: values[i]!,
          valid: r.valid,
          matched_term_id: r.matched_term?.term_id,
          matched_value: r.matched_term?.value,
        })))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Validate Term Values against {terminologyValue}</h3>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Values (one per line)</label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={"value1\nvalue2\nvalue3"}
          rows={4}
          className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-blue-400"
          autoFocus
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={handleValidate}
        disabled={loading || !input.trim()}
        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Validating...' : 'Validate'}
      </button>
      {results.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg divide-y divide-gray-100">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2">
              {r.valid
                ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                : <XCircle size={14} className="text-red-500 shrink-0" />
              }
              <span className="text-sm font-mono text-gray-700">{r.value}</span>
              {r.valid && r.matched_value && r.matched_value !== r.value && (
                <span className="text-xs text-gray-400">matched: {r.matched_value}</span>
              )}
            </div>
          ))}
          <div className="px-4 py-2 text-xs text-gray-500">
            {results.filter(r => r.valid).length} valid, {results.filter(r => !r.valid).length} invalid
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import Panel
// ---------------------------------------------------------------------------

function ImportPanel({ terminologyId, namespace, onClose }: { terminologyId: string; namespace: string; onClose: () => void }) {
  const client = useWipClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ terms: number; errors: number; relationships: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async () => {
    if (!selectedFile) return
    setImporting(true)
    setError(null)
    try {
      const text = await selectedFile.text()
      const data = JSON.parse(text)

      // Support two formats: full ImportTerminologyRequest (with terminology+terms) or just an array of terms
      if (Array.isArray(data)) {
        // Array of terms — create them via createTerms
        let created = 0
        let errors = 0
        for (const term of data) {
          try {
            await client.defStore.createTerm(terminologyId, {
              value: term.value,
              label: term.label,
              description: term.description,
              aliases: term.aliases,
              sort_order: term.sort_order,
              parent_term_id: term.parent_term_id,
              translations: term.translations,
              metadata: term.metadata,
              created_by: 'rc-console',
            }, { namespace })
            created++
          } catch {
            errors++
          }
        }
        setResult({ terms: created, errors, relationships: 0 })
      } else if (data.terminology && data.terms) {
        // Full import format
        const res = await client.defStore.importTerminology({
          terminology: { ...data.terminology, namespace },
          terms: data.terms,
          relationships: data.relationships,
        })
        const termsOk = (res.terms_result?.results ?? []).filter(r => r.status === 'ok' || r.status === 'created').length
        const termsErr = (res.terms_result?.results ?? []).filter(r => r.status !== 'ok' && r.status !== 'created').length
        setResult({
          terms: termsOk,
          errors: termsErr,
          relationships: res.relationships_result?.created ?? 0,
        })
      } else {
        setError('Unrecognized format. Expected either a JSON array of terms or an object with {terminology, terms}.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Import Terms (JSON)</h3>
      <p className="text-xs text-gray-400">
        Upload a JSON file: either an array of term objects [{`{value, label, ...}`}] or a full export [{`{terminology, terms, relationships}`}].
      </p>
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={e => { setSelectedFile(e.target.files?.[0] ?? null); setError(null); setResult(null) }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-lg py-4 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex flex-col items-center gap-1"
        >
          <Upload size={18} />
          {selectedFile ? selectedFile.name : 'Click to select a JSON file'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {result && (
        <div className="text-sm text-gray-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          Imported {result.terms} term{result.terms !== 1 ? 's' : ''}
          {result.relationships > 0 && `, ${result.relationships} relationship${result.relationships !== 1 ? 's' : ''}`}
          {result.errors > 0 && <span className="text-red-600"> ({result.errors} error{result.errors !== 1 ? 's' : ''})</span>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={handleImport}
          disabled={importing || !selectedFile}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {importing ? 'Importing...' : 'Import'}
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
  const [showValidate, setShowValidate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  // Edit form state
  const [editLabel, setEditLabel] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCaseSensitive, setEditCaseSensitive] = useState(false)
  const [editAllowMultiple, setEditAllowMultiple] = useState(false)
  const [editExtensible, setEditExtensible] = useState(true)
  const [editMutable, setEditMutable] = useState(true)
  const [editShowMeta, setEditShowMeta] = useState(false)
  const [editMetaSource, setEditMetaSource] = useState('')
  const [editMetaSourceUrl, setEditMetaSourceUrl] = useState('')
  const [editMetaVersion, setEditMetaVersion] = useState('')
  const [editMetaLanguage, setEditMetaLanguage] = useState('')

  const client = useWipClient()
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
    setEditAllowMultiple(terminology.allow_multiple ?? false)
    setEditExtensible(terminology.extensible)
    setEditMutable(terminology.mutable)
    const meta = terminology.metadata
    setEditMetaSource(meta?.source ?? '')
    setEditMetaSourceUrl(meta?.source_url ?? '')
    setEditMetaVersion(meta?.version ?? '')
    setEditMetaLanguage(meta?.language ?? '')
    setEditShowMeta(!!(meta?.source || meta?.source_url || meta?.version || meta?.language))
    setEditing(true)
    setConfirmDelete(false)
  }

  const handleSave = () => {
    if (!terminology) return
    const metadata: Record<string, unknown> = {}
    if (editMetaSource.trim()) metadata.source = editMetaSource.trim()
    if (editMetaSourceUrl.trim()) metadata.source_url = editMetaSourceUrl.trim()
    if (editMetaVersion.trim()) metadata.version = editMetaVersion.trim()
    if (editMetaLanguage.trim()) metadata.language = editMetaLanguage.trim()

    updateTerminology.mutate({
      id: terminology.terminology_id,
      data: {
        label: editLabel.trim() || undefined,
        description: editDesc.trim() || undefined,
        case_sensitive: editCaseSensitive,
        allow_multiple: editAllowMultiple,
        extensible: editExtensible,
        mutable: editMutable,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
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
          {/* Action buttons */}
          {!editing && !confirmDelete && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => {
                  setExportLoading(true)
                  try {
                    const result = await client.defStore.exportTerminology(terminology!.terminology_id, {
                      format: 'json',
                      includeInactive: true,
                      includeRelationships: true,
                      includeMetadata: true,
                    })
                    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${terminology!.value}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                  } finally {
                    setExportLoading(false)
                  }
                }}
                disabled={exportLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download size={12} />
                {exportLoading ? '...' : 'Export'}
              </button>
              <button
                onClick={() => { setShowImport(s => !s); setShowValidate(false) }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              >
                <Upload size={12} />
                Import
              </button>
              <button
                onClick={() => { setShowValidate(s => !s); setShowImport(false) }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              >
                <CheckCircle size={12} />
                Validate
              </button>
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
            <div className="flex items-center flex-wrap gap-4 pt-5">
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
                  checked={editAllowMultiple}
                  onChange={e => setEditAllowMultiple(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Allow multiple
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
              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={editMutable}
                  onChange={e => setEditMutable(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Mutable
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
          {/* Metadata (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setEditShowMeta(s => !s)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              {editShowMeta ? 'Hide metadata' : 'Show metadata fields'}
            </button>
            {editShowMeta && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Source</label>
                  <input
                    type="text"
                    value={editMetaSource}
                    onChange={e => setEditMetaSource(e.target.value)}
                    placeholder="e.g. ICD-10, SNOMED CT"
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Source URL</label>
                  <input
                    type="text"
                    value={editMetaSourceUrl}
                    onChange={e => setEditMetaSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Version</label>
                  <input
                    type="text"
                    value={editMetaVersion}
                    onChange={e => setEditMetaVersion(e.target.value)}
                    placeholder="e.g. 2024.1"
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Language</label>
                  <input
                    type="text"
                    value={editMetaLanguage}
                    onChange={e => setEditMetaLanguage(e.target.value)}
                    placeholder="e.g. en, de"
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            )}
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

      {/* Validate panel */}
      {showValidate && (
        <ValidatePanel terminologyId={terminology.terminology_id} terminologyValue={terminology.value} />
      )}

      {/* Import panel */}
      {showImport && (
        <ImportPanel terminologyId={terminology.terminology_id} namespace={terminology.namespace} onClose={() => setShowImport(false)} />
      )}

      {/* Metadata */}
      <div className="flex items-center flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Hash size={10} />
          ID: {terminology.terminology_id}
        </span>
        {terminology.term_count !== undefined && (
          <span>{terminology.term_count} terms</span>
        )}
        <span>{terminology.case_sensitive ? 'Case sensitive' : 'Case insensitive'}</span>
        <span>{terminology.allow_multiple ? 'Allow multiple' : 'Single value'}</span>
        <span>{terminology.extensible ? 'Extensible' : 'Fixed'}</span>
        <span>{terminology.mutable ? 'Mutable' : 'Immutable'}</span>
        {terminology.created_at && (
          <span>Created: {new Date(terminology.created_at).toLocaleDateString()}</span>
        )}
        {terminology.created_by && (
          <span>By: {terminology.created_by}</span>
        )}
        {terminology.updated_at && (
          <span>Updated: {new Date(terminology.updated_at!).toLocaleDateString()}</span>
        )}
      </div>
      {/* Terminology metadata (source, language, etc.) */}
      {(() => {
        const meta = terminology.metadata
        if (!meta) return null
        if (!meta.source && !meta.source_url && !meta.version && !meta.language) return null
        return (
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
            {meta.source && <span>Source: {meta.source}</span>}
            {meta.source_url && (
              <a href={meta.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600 underline">
                {meta.source_url}
              </a>
            )}
            {meta.version && <span>Version: {meta.version}</span>}
            {meta.language && <span>Language: {meta.language}</span>}
          </div>
        )
      })()}

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
            namespace={terminology.namespace}
            existingTerms={termsData?.items ?? []}
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
                    allTerms={termsData.items ?? []}
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

      {/* Raw JSON */}
      <details className="group">
        <summary className="text-sm font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700">
          Raw JSON
        </summary>
        <div className="mt-2">
          <JsonViewer data={terminology} maxHeight="400px" collapsed />
        </div>
      </details>
    </div>
  )
}
