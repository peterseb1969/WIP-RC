import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Tag,
  ArrowLeft,
  Info,
  Network,
  GitBranch,
  Code,
  Copy,
  Check,
} from 'lucide-react'
import { useTerm, useTerminology } from '@wip/react'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = (searchParams.get('tab') as TabKey | null) ?? 'overview'
  const activeTab: TabKey = TABS.some(t => t.key === tabParam) ? tabParam : 'overview'

  const setTab = (key: TabKey) => {
    const next = new URLSearchParams(searchParams)
    if (key === 'overview') next.delete('tab')
    else next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  const termQuery = useTerm(termId ?? '', { enabled: !!termId })
  const terminologyQuery = useTerminology(tid ?? '', { enabled: !!tid })

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
      <TermHeader term={term} />

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
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab term={term} />}
      {activeTab === 'relationships' && <ComingSoon label="Relationships" />}
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

function TermHeader({ term }: { term: import('@wip/client').Term }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(term.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview tab — read-only for v1
// ---------------------------------------------------------------------------

function OverviewTab({ term }: { term: import('@wip/client').Term }) {
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

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="bg-white border border-gray-200 border-dashed rounded-lg p-8 text-center">
      <p className="text-sm text-gray-400">{label} tab — coming in the next step.</p>
    </div>
  )
}

