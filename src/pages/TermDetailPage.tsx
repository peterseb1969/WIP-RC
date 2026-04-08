import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Tag,
  ArrowLeft,
  Info,
  Network,
  GitBranch,
  Code,
  Copy,
  Check,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react'
import {
  useTerm,
  useTerminology,
  useTerms,
  useUpdateTerm,
  useDeprecateTerm,
  useDeleteTerm,
  useWipClient,
} from '@wip/react'
import { useQuery } from '@tanstack/react-query'
import type { Term, Relationship } from '@wip/client'
import StatusBadge from '@/components/common/StatusBadge'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import JsonViewer from '@/components/common/JsonViewer'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// TermDetailPage — step 2 of the Ontology UI build (DESIGN.md).
//
// Route: /terminologies/:tid/terms/:termId
// Tabs:  overview (default) | relationships | hierarchy | raw
//
// This is the skeleton: route + header + tab nav + read-only Overview tab
// + raw JSON tab. Edit/Relationships/Hierarchy come in later steps.
// ---------------------------------------------------------------------------

type TabKey = 'overview' | 'relationships' | 'hierarchy' | 'raw'

const TABS: { key: TabKey; label: string; icon: typeof Info }[] = [
  { key: 'overview', label: 'Overview', icon: Info },
  { key: 'relationships', label: 'Relationships', icon: Network },
  { key: 'hierarchy', label: 'Hierarchy', icon: GitBranch },
  { key: 'raw', label: 'Raw JSON', icon: Code },
]

export default function TermDetailPage() {
  const { tid, termId } = useParams<{ tid: string; termId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = (searchParams.get('tab') as TabKey | null) ?? 'overview'
  const activeTab: TabKey = TABS.some(t => t.key === tabParam) ? tabParam : 'overview'
  const [editing, setEditing] = useState(false)

  const setTab = (key: TabKey) => {
    const next = new URLSearchParams(searchParams)
    if (key === 'overview') next.delete('tab')
    else next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  const termQuery = useTerm(termId ?? '', { enabled: !!termId })
  const terminologyQuery = useTerminology(tid ?? '', { enabled: !!tid })
  // Relationship count for the tab badge — fetched once at top level so the
  // number is visible even when other tabs are active.
  const client = useWipClient()
  const relCountQuery = useQuery({
    queryKey: ['rc-console', 'relationships-count', termId],
    queryFn: () =>
      client.defStore.listRelationships({
        term_id: termId ?? '',
        direction: 'both',
        page_size: 1,
      }),
    enabled: !!termId,
    staleTime: 30_000,
  })
  const relCount = relCountQuery.data?.total ?? null

  if (!tid || !termId) {
    return <ErrorState message="Missing terminology or term id in URL" />
  }
  if (termQuery.isLoading || terminologyQuery.isLoading) {
    return <LoadingState />
  }
  if (termQuery.error) {
    return <ErrorState message={termQuery.error.message} />
  }
  if (!termQuery.data) {
    return <ErrorState message="Term not found" />
  }

  const term = termQuery.data
  const terminology = terminologyQuery.data

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Back link */}
      <Link
        to={`/terminologies/${tid}`}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={12} />
        Back to {terminology?.label || terminology?.value || 'terminology'}
      </Link>

      {/* Header */}
      <TermHeader
        term={term}
        editing={editing}
        onEdit={() => {
          setEditing(true)
          setTab('overview')
        }}
        onDeleted={() => navigate(`/terminologies/${tid}`)}
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon size={14} />
              {label}
              {key === 'relationships' && relCount !== null && relCount > 0 && (
                <span
                  className={cn(
                    'ml-0.5 px-1.5 py-0.5 rounded text-[10px]',
                    activeTab === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {relCount}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' &&
        (editing ? (
          <OverviewEdit term={term} onClose={() => setEditing(false)} />
        ) : (
          <OverviewTab term={term} />
        ))}
      {activeTab === 'relationships' && <RelationshipsTab term={term} />}
      {activeTab === 'hierarchy' && <ComingSoon label="Hierarchy" />}
      {activeTab === 'raw' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <JsonViewer data={term} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function TermHeader({
  term,
  editing,
  onEdit,
  onDeleted,
}: {
  term: Term
  editing: boolean
  onEdit: () => void
  onDeleted: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [showDeprecate, setShowDeprecate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deprecateReason, setDeprecateReason] = useState('')

  const deprecate = useDeprecateTerm({
    onSuccess: () => {
      setShowDeprecate(false)
      setDeprecateReason('')
    },
  })
  const remove = useDeleteTerm(term.terminology_id, {
    onSuccess: () => onDeleted(),
  })

  const handleCopy = () => {
    navigator.clipboard.writeText(term.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Tag size={22} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-gray-800">
              {term.label || term.value}
            </h1>
            <StatusBadge
              status={
                term.status === 'active'
                  ? 'active'
                  : term.status === 'deprecated'
                  ? 'warning'
                  : 'inactive'
              }
              label={term.status}
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-gray-500">{term.value}</span>
            <button
              onClick={handleCopy}
              className="text-gray-300 hover:text-gray-500"
              title="Copy value"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
          </div>
          {term.description && (
            <p className="text-sm text-gray-500 mt-1">{term.description}</p>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="px-2.5 py-1 border border-gray-200 text-xs rounded-md text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1"
            >
              <Pencil size={12} /> Edit
            </button>
            {term.status === 'active' && (
              <button
                onClick={() => {
                  setShowDeprecate(true)
                  setConfirmDelete(false)
                }}
                className="px-2.5 py-1 border border-gray-200 text-xs rounded-md text-amber-600 hover:bg-amber-50 inline-flex items-center gap-1"
              >
                <AlertTriangle size={12} /> Deprecate
              </button>
            )}
            <button
              onClick={() => {
                setConfirmDelete(true)
                setShowDeprecate(false)
              }}
              className="px-2.5 py-1 border border-gray-200 text-xs rounded-md text-red-600 hover:bg-red-50 inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Deprecate inline form */}
      {showDeprecate && (
        <div className="ml-9 bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-sm text-amber-800 font-medium">Deprecate this term?</span>
          </div>
          <input
            type="text"
            value={deprecateReason}
            onChange={e => setDeprecateReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full max-w-md border border-amber-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-amber-400"
            autoFocus
          />
          {deprecate.error && <p className="text-xs text-red-600">{deprecate.error.message}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                deprecate.mutate({
                  termId: term.term_id,
                  data: {
                    reason: deprecateReason.trim() || 'Deprecated',
                    updated_by: 'rc-console',
                  },
                })
              }
              disabled={deprecate.isPending}
              className="px-2.5 py-1 bg-amber-500 text-white text-xs rounded-md hover:bg-amber-600 disabled:opacity-50"
            >
              {deprecate.isPending ? 'Deprecating...' : 'Confirm deprecate'}
            </button>
            <button
              onClick={() => setShowDeprecate(false)}
              className="px-2.5 py-1 border border-gray-200 text-xs rounded-md text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="ml-9 bg-red-50 border border-red-200 rounded-md p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Trash2 size={14} className="text-red-500" />
            <span className="text-sm text-red-800 font-medium">
              Permanently delete this term? This cannot be undone.
            </span>
          </div>
          {remove.error && <p className="text-xs text-red-600">{remove.error.message}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={() => remove.mutate(term.term_id)}
              disabled={remove.isPending}
              className="px-2.5 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {remove.isPending ? 'Deleting...' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1 border border-gray-200 text-xs rounded-md text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview edit form
// ---------------------------------------------------------------------------

function OverviewEdit({ term, onClose }: { term: Term; onClose: () => void }) {
  const [label, setLabel] = useState(term.label ?? '')
  const [description, setDescription] = useState(term.description ?? '')
  const [aliases, setAliases] = useState(term.aliases?.join(', ') ?? '')
  const [sortOrder, setSortOrder] = useState(String(term.sort_order ?? ''))
  const [parentTermId, setParentTermId] = useState(term.parent_term_id ?? '')

  // Load sibling terms for the parent picker. We only need active ones for the
  // dropdown — same behaviour as the inline TermRow editor. The /terms endpoint
  // caps page_size at 100, so terminologies with more siblings will need a
  // search-style picker (TODO when we revisit the legacy parent UX).
  const siblingsQuery = useTerms(term.terminology_id, {
    page_size: 100,
    status: 'active',
  })
  const siblings = (siblingsQuery.data?.items ?? []).filter(t => t.term_id !== term.term_id)

  const update = useUpdateTerm({
    onSuccess: () => onClose(),
  })

  const handleSave = () => {
    update.mutate({
      termId: term.term_id,
      data: {
        label: label.trim() || undefined,
        description: description.trim() || undefined,
        aliases: aliases.trim()
          ? aliases.split(',').map(a => a.trim()).filter(Boolean)
          : [],
        sort_order: sortOrder.trim() ? parseInt(sortOrder, 10) : undefined,
        parent_term_id: parentTermId || undefined,
        updated_by: 'rc-console',
      },
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Edit term</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-0.5">Value (read-only)</label>
        <input
          type="text"
          value={term.value}
          readOnly
          className="w-full max-w-md border border-gray-100 bg-gray-50 rounded-md px-2 py-1 text-sm font-mono text-gray-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-0.5">Label</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="w-full max-w-md border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-0.5">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="w-full max-w-2xl border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-0.5">Aliases (comma-separated)</label>
        <input
          type="text"
          value={aliases}
          onChange={e => setAliases(e.target.value)}
          className="w-full max-w-2xl border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-2xl">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Sort order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            placeholder="0"
            className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Parent term (legacy)</label>
          <select
            value={parentTermId}
            onChange={e => setParentTermId(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
            disabled={siblingsQuery.isLoading}
          >
            <option value="">None</option>
            {siblings.map(t => (
              <option key={t.term_id} value={t.term_id}>
                {t.label || t.value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {update.error && <p className="text-xs text-red-500">{update.error.message}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {update.isPending ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview tab — read-only for v1
// ---------------------------------------------------------------------------

function OverviewTab({ term }: { term: Term }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
      <Section title="Identity">
        <Field label="Value" mono>
          {term.value}
        </Field>
        <Field label="Label">{term.label || <Muted>—</Muted>}</Field>
        <Field label="Description">{term.description || <Muted>—</Muted>}</Field>
        <Field label="Sort order">{term.sort_order ?? <Muted>—</Muted>}</Field>
      </Section>

      <Section title="Aliases">
        {term.aliases && term.aliases.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {term.aliases.map((a, i) => (
              <span
                key={`${a}-${i}`}
                className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-mono"
              >
                {a}
              </span>
            ))}
          </div>
        ) : (
          <Muted>No aliases</Muted>
        )}
      </Section>

      <Section title="Translations">
        {term.translations && term.translations.length > 0 ? (
          <table className="text-sm w-full max-w-md">
            <tbody>
              {term.translations.map((t, i) => (
                <tr key={`${t.language}-${i}`} className="border-b border-gray-50 last:border-0">
                  <td className="py-1 pr-4 text-xs font-mono text-gray-500 w-16">{t.language}</td>
                  <td className="py-1 text-gray-700">{t.label || <Muted>—</Muted>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Muted>No translations</Muted>
        )}
      </Section>

      <Section title="Hierarchy (legacy)">
        <Field label="Parent term">
          {term.parent_term_id ? (
            <Link
              to={`/terminologies/${term.terminology_id}/terms/${term.parent_term_id}`}
              className="text-blue-600 hover:underline font-mono text-xs"
            >
              {term.parent_term_id}
            </Link>
          ) : (
            <Muted>No parent</Muted>
          )}
        </Field>
        <p className="text-xs text-gray-400 mt-1">
          Use the <span className="font-medium">Relationships</span> tab for typed and multi-parent
          relationships.
        </p>
      </Section>

      {term.status === 'deprecated' && (
        <Section title="Deprecation">
          <Field label="Reason">{term.deprecated_reason || <Muted>—</Muted>}</Field>
          <Field label="Replaced by">
            {term.replaced_by_term_id ? (
              <Link
                to={`/terminologies/${term.terminology_id}/terms/${term.replaced_by_term_id}`}
                className="text-blue-600 hover:underline font-mono text-xs"
              >
                {term.replaced_by_term_id}
              </Link>
            ) : (
              <Muted>—</Muted>
            )}
          </Field>
        </Section>
      )}

      <Section title="Metadata">
        {term.metadata && Object.keys(term.metadata).length > 0 ? (
          <pre className="text-xs bg-gray-50 border border-gray-100 rounded p-2 overflow-x-auto max-w-2xl">
            {JSON.stringify(term.metadata, null, 2)}
          </pre>
        ) : (
          <Muted>No metadata</Muted>
        )}
      </Section>

      <Section title="Audit">
        <Field label="Term ID" mono>
          {term.term_id}
        </Field>
        <Field label="Namespace" mono>
          {term.namespace}
        </Field>
        <Field label="Terminology" mono>
          {term.terminology_value || term.terminology_id}
        </Field>
        <Field label="Created">
          <Timestamp value={term.created_at} by={term.created_by} />
        </Field>
        <Field label="Updated">
          <Timestamp value={term.updated_at} by={term.updated_by} />
        </Field>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Field({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="text-xs text-gray-400 w-32 shrink-0">{label}</span>
      <span className={cn('text-gray-700 min-w-0 break-words', mono && 'font-mono text-xs')}>
        {children}
      </span>
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-300">{children}</span>
}

function Timestamp({ value, by }: { value: string; by?: string }) {
  if (!value) return <Muted>—</Muted>
  return (
    <span className="text-xs text-gray-500">
      {new Date(value).toLocaleString()}
      {by && <span className="text-gray-400"> by {by}</span>}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Relationships tab — read-only list grouped by type, both directions.
// Add and Delete come in steps 5 & 6.
// ---------------------------------------------------------------------------

function useRelationships(termId: string, direction: 'outgoing' | 'incoming') {
  const client = useWipClient()
  return useQuery({
    queryKey: ['rc-console', 'relationships', termId, direction],
    queryFn: () =>
      client.defStore.listRelationships({
        term_id: termId,
        direction,
        page_size: 100,
      }),
    enabled: !!termId,
    staleTime: 30_000,
  })
}

function RelationshipsTab({ term }: { term: Term }) {
  const outgoing = useRelationships(term.term_id, 'outgoing')
  const incoming = useRelationships(term.term_id, 'incoming')

  return (
    <div className="space-y-4">
      <RelationshipSection
        title="Outgoing"
        emptyText="No outgoing relationships"
        currentTerm={term}
        query={outgoing}
        side="target"
      />
      <RelationshipSection
        title="Incoming"
        emptyText="No incoming relationships"
        currentTerm={term}
        query={incoming}
        side="source"
      />
    </div>
  )
}

function RelationshipSection({
  title,
  emptyText,
  currentTerm,
  query,
  side,
}: {
  title: string
  emptyText: string
  currentTerm: Term
  query: ReturnType<typeof useRelationships>
  side: 'source' | 'target'
}) {
  const items = query.data?.items ?? []
  const total = query.data?.total ?? items.length

  // Group by relationship_type
  const groups = items.reduce<Record<string, Relationship[]>>((acc, rel) => {
    const key = rel.relationship_type
    if (!acc[key]) acc[key] = []
    acc[key]!.push(rel)
    return acc
  }, {})
  const groupKeys = Object.keys(groups).sort()

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">
          {title}
          {!query.isLoading && (
            <span className="ml-2 text-xs text-gray-400">({total})</span>
          )}
        </h3>
      </div>

      {query.isLoading && (
        <div className="px-4 py-3 text-xs text-gray-400">Loading...</div>
      )}
      {query.isError && (
        <div className="px-4 py-3 text-xs text-red-600">
          {(query.error as Error).message}
        </div>
      )}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <div className="px-4 py-3 text-xs text-gray-400">{emptyText}</div>
      )}

      {groupKeys.map(type => (
        <div key={type} className="border-t border-gray-50 first:border-t-0">
          <div className="px-4 py-1.5 bg-gray-50 text-xs font-mono font-medium text-gray-600">
            {type}
            <span className="ml-2 text-gray-400">({groups[type]!.length})</span>
          </div>
          <div className="divide-y divide-gray-50">
            {groups[type]!.map((rel, i) => (
              <RelationshipRow
                key={`${rel.source_term_id}-${rel.target_term_id}-${type}-${i}`}
                rel={rel}
                currentTerm={currentTerm}
                side={side}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function RelationshipRow({
  rel,
  currentTerm,
  side,
}: {
  rel: Relationship
  currentTerm: Term
  side: 'source' | 'target'
}) {
  // `side` says which end of the relationship is the OTHER term — i.e., the
  // one we want to display. For an outgoing relationship the other end is the
  // target; for incoming it's the source.
  const otherTermId = side === 'target' ? rel.target_term_id : rel.source_term_id
  const otherValue = side === 'target' ? rel.target_term_value : rel.source_term_value
  const otherLabel = side === 'target' ? rel.target_term_label : rel.source_term_label
  const otherTerminologyId =
    side === 'target' ? rel.target_terminology_id : rel.source_terminology_id

  const crossTerminology =
    !!otherTerminologyId && otherTerminologyId !== currentTerm.terminology_id

  // We can only build a stable link to the other term if we know its
  // terminology_id (the route is /terminologies/:tid/terms/:termId). When the
  // server sent it denormalized, use it; otherwise fall back to the current
  // terminology (same-terminology relationships are the common case).
  const linkTerminologyId = otherTerminologyId ?? currentTerm.terminology_id

  return (
    <div className="px-4 py-2 flex items-center gap-2 hover:bg-gray-50">
      <Tag size={12} className="text-gray-300 shrink-0" />
      <Link
        to={`/terminologies/${linkTerminologyId}/terms/${otherTermId}`}
        className="text-sm text-gray-800 hover:text-blue-600 hover:underline truncate"
      >
        {otherLabel || otherValue || otherTermId}
      </Link>
      {otherValue && (
        <span className="text-xs font-mono text-gray-400 truncate">{otherValue}</span>
      )}
      {crossTerminology && (
        <span
          className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-mono"
          title={otherTerminologyId}
        >
          cross-terminology
        </span>
      )}
      {rel.status !== 'active' && (
        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">
          {rel.status}
        </span>
      )}
    </div>
  )
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="bg-white border border-gray-200 border-dashed rounded-lg p-8 text-center">
      <p className="text-sm text-gray-400">{label} tab — coming in the next step.</p>
    </div>
  )
}

