import { useQueries } from '@tanstack/react-query'
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import {
  useReportingInventory,
  fetchNamespaceParity,
  PARITY_QUERY_KEY,
  type NamespaceParity,
  type ParityTemplate,
} from '@/hooks/use-reporting'
import LoadingState from '@/components/common/LoadingState'
import { cn } from '@/lib/cn'

// Parity surface (CASE-716 item 4): per-namespace document-vs-reporting
// parity with the CASE-710 fields. legacy_table is the one state that needs
// operator action — the platform deliberately never drops the pre-split
// table itself.

function templateHasIssue(t: ParityTemplate): boolean {
  return Boolean(
    t.legacy_table ||
    (t.sync_enabled && !t.table_present) ||
    (t.sync_enabled && t.view_present === false) ||
    (t.counts_comparable && !t.counts_match) ||
    t.missing_columns.length > 0 ||
    t.error
  )
}

function TemplateIssueRow({ t }: { t: ParityTemplate }) {
  return (
    <div className="px-3 py-2 text-xs space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-mono font-medium text-gray-700">{t.template_value}</span>
        {t.version_tables && t.version_tables.length > 0 && (
          <span className="text-gray-400">
            v{t.version_tables.join(', v')}
          </span>
        )}
        {t.counts_comparable && (
          <span className={cn(t.counts_match ? 'text-gray-400' : 'text-danger')}>
            {t.actual_rows.toLocaleString()} rows / {t.expected_documents.toLocaleString()} docs
          </span>
        )}
      </div>
      {t.legacy_table && (
        <div className="flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-amber-700">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>
            A pre-split legacy table is shadowing this entity&apos;s view. The platform never
            drops it automatically — remediation: drop the legacy table, then rebuild via a
            batch sync (Batch Sync tab).
          </span>
        </div>
      )}
      {t.sync_enabled && t.view_present === false && (
        <p className="text-danger">Entity view missing.</p>
      )}
      {t.sync_enabled && !t.table_present && (
        <p className="text-danger">No reporting relation present.</p>
      )}
      {t.missing_columns.length > 0 && (
        <p className="text-danger">Missing columns: {t.missing_columns.join(', ')}</p>
      )}
      {t.counts_comparable && !t.counts_match && (
        <p className="text-danger">Row count does not match document count.</p>
      )}
      {t.error && <p className="text-danger font-mono">{t.error}</p>}
    </div>
  )
}

function NamespaceParityCard({ parity }: { parity: NamespaceParity }) {
  const [showAll, setShowAll] = useState(false)
  const issues = parity.templates.filter(templateHasIssue)
  const clean = parity.templates.length - issues.length

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
        <span className={cn('inline-flex', parity.ok ? 'text-success' : 'text-danger')}>
          {parity.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
        </span>
        <span className="text-sm font-medium text-gray-700">{parity.namespace}</span>
        <span className="text-xs text-gray-400">
          {parity.table_count} relations · {parity.templates.length} templates
          {parity.templates_skipped_sync_disabled > 0 &&
            ` · ${parity.templates_skipped_sync_disabled} sync-disabled`}
        </span>
        <span className="ml-auto text-xs text-gray-400">
          {parity.structural_issues} structural · {parity.count_mismatches} count mismatches
        </span>
      </div>

      {!parity.schema_present && (
        <p className="px-4 py-3 text-xs text-danger">PostgreSQL schema missing for this namespace.</p>
      )}
      {parity.bookkeeping_error && (
        <p className="px-4 py-3 text-xs text-danger font-mono">{parity.bookkeeping_error}</p>
      )}

      {issues.length > 0 ? (
        <div className="divide-y divide-gray-50">
          {issues.map(t => <TemplateIssueRow key={t.template_value} t={t} />)}
        </div>
      ) : (
        <p className="px-4 py-3 text-xs text-gray-400">
          All {parity.templates.length} templates in parity — views present, counts match.
        </p>
      )}

      {clean > 0 && issues.length > 0 && (
        <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-50">
          {clean} other template{clean !== 1 ? 's' : ''} in parity.
        </p>
      )}

      {parity.templates.length > 0 && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="w-full px-4 py-1.5 text-left text-[11px] text-gray-400 hover:text-gray-600 border-t border-gray-50 inline-flex items-center gap-1"
        >
          {showAll ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {showAll ? 'Hide' : 'Show'} all templates
        </button>
      )}
      {showAll && (
        <div className="divide-y divide-gray-50 border-t border-gray-100">
          {parity.templates.map(t => (
            <div key={t.template_value} className="px-3 py-1.5 flex items-center gap-2 text-xs">
              <span className={cn('inline-flex', templateHasIssue(t) ? 'text-danger' : 'text-success')}>
                {templateHasIssue(t) ? <XCircle size={11} /> : <CheckCircle size={11} />}
              </span>
              <span className="font-mono text-gray-600">{t.template_value}</span>
              {t.version_tables && t.version_tables.length > 0 && (
                <span className="text-gray-400">v{t.version_tables.join(', v')}</span>
              )}
              {t.view_present && (
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded">view</span>
              )}
              {!t.sync_enabled && <span className="text-gray-300">sync disabled</span>}
              <span className="ml-auto text-gray-400">
                {t.counts_comparable
                  ? `${t.actual_rows.toLocaleString()} rows`
                  : 'counts not comparable'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ParityPanel() {
  const { data: inventory, isLoading } = useReportingInventory()
  const namespaces = [...new Set((inventory?.tables ?? []).map(t => t.namespace))].sort()

  const results = useQueries({
    queries: namespaces.map(ns => ({
      queryKey: PARITY_QUERY_KEY(ns),
      queryFn: () => fetchNamespaceParity(ns),
      staleTime: 60_000,
    })),
  })

  if (isLoading) return <LoadingState label="Loading namespaces..." />
  if (namespaces.length === 0) {
    return <p className="text-sm text-gray-400">No reporting namespaces found.</p>
  }

  return (
    <div className="space-y-3 max-w-4xl">
      <p className="text-xs text-gray-400">
        Compares document counts against the reporting layer per template, and flags
        structural gaps (missing views, legacy pre-split tables, column drift).
      </p>
      {namespaces.map((ns, i) => {
        const q = results[i]
        if (q?.isLoading) return <LoadingState key={ns} label={`Checking ${ns}...`} />
        if (q?.error) {
          return (
            <div key={ns} className="bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 text-xs text-danger">
              {ns}: {q.error.message}
            </div>
          )
        }
        return q?.data ? <NamespaceParityCard key={ns} parity={q.data} /> : null
      })}
    </div>
  )
}
