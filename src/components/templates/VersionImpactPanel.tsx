import { Layers, AlertTriangle, CheckCircle, HelpCircle, ArrowRight } from 'lucide-react'
import type { TemplateVersionEventDetails } from '@wip/client'
import { cn } from '@/lib/cn'

// Version-event impact (CASE-711 / CASE-722). Shown after a save that minted a
// new template version: how many live documents it affects, and whether the
// change is migration-eligible. Informational only — the platform chose
// loud-but-non-blocking (FIRESIDE-23), so this never gates anything.

function DiffLine({ label, fields, tone }: { label: string; fields?: string[]; tone?: 'danger' }) {
  if (!fields || fields.length === 0) return null
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={cn('shrink-0', tone === 'danger' ? 'text-danger' : 'text-gray-400')}>{label}</span>
      <span className="font-mono text-gray-600">{fields.join(', ')}</span>
    </div>
  )
}

export default function VersionImpactPanel({
  details,
  version,
  onDismiss,
}: {
  details: TemplateVersionEventDetails
  version?: number
  onDismiss?: () => void
}) {
  const impact = details.impact
  const migration = details.migration
  const unavailable = impact != null && impact.status !== 'ok'
  // changed_type carries the old/new pair per field, not a bare name — it was
  // rendered through the plain field list until the client typed it.
  const changedTypes = (details.changed_type ?? []).map(
    c => `${c.name}: ${c.old_type} → ${c.new_type}`,
  )
  const identity = details.identity_changed
  const docsPerVersion = Object.entries(impact?.docs_per_version ?? {})
  const fieldCounts = Object.entries(impact?.field_nonempty_counts ?? {})

  return (
    <div className="bg-white border border-primary/20 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layers size={16} className="text-primary shrink-0" />
        <span className="text-sm font-medium text-gray-800">
          {version != null ? `Version ${version} created` : 'New version created'}
        </span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Schema diff */}
      <div className="space-y-1">
        <DiffLine label="Added" fields={details.added_optional} />
        <DiffLine label="Added (required)" fields={details.added_required} tone="danger" />
        <DiffLine label="Removed" fields={details.removed} tone="danger" />
        <DiffLine label="Type changed" fields={changedTypes} tone="danger" />
        <DiffLine label="Now required" fields={details.made_required} tone="danger" />
        <DiffLine label="Modified" fields={details.modified_existing} />
        {identity && (
          <div className="flex items-start gap-2 text-xs">
            <span className="shrink-0 text-danger">Identity changed</span>
            <span className="font-mono text-gray-600">
              {identity.old.join(', ') || '—'} → {identity.new.join(', ') || '—'}
            </span>
          </div>
        )}
      </div>

      {/* Impact — live documents */}
      {impact && (
        unavailable ? (
          <div className="flex items-start gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
            <HelpCircle size={13} className="shrink-0 mt-0.5 text-gray-400" />
            <span>
              Impact could not be determined
              {impact.reason ? ` — ${impact.reason}` : ''}.
              The version was created; the number of affected documents is unknown, not zero.
            </span>
          </div>
        ) : (
          <div className="text-xs space-y-1">
            <div className="text-gray-600">
              Affects{' '}
              <span className="font-medium text-gray-800">
                {(impact.total_live_docs ?? 0).toLocaleString()} live document
                {impact.total_live_docs === 1 ? '' : 's'}
              </span>
              {docsPerVersion.length > 0 && (
                <span className="text-gray-400">
                  {' '}({docsPerVersion.map(([v, n], i) => (
                    <span key={v}>{i > 0 && ', '}v{v}: {n.toLocaleString()}</span>
                  ))})
                </span>
              )}
            </div>
            {fieldCounts.length > 0 && (
              <div className="text-gray-400">
                Non-empty values:{' '}
                {fieldCounts.map(([f, n], i) => (
                  <span key={f} className="font-mono">
                    {i > 0 && ', '}{f}: {n.toLocaleString()}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* Migration verdict */}
      {migration && (
        <div className={cn(
          'flex items-start gap-2 p-2.5 rounded text-xs border',
          migration.eligible === true
            ? 'bg-success/5 border-success/30 text-gray-700'
            : migration.eligible === false
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-gray-50 border-gray-200 text-gray-600',
        )}>
          {migration.eligible === true
            ? <CheckCircle size={13} className="shrink-0 mt-0.5 text-success" />
            : migration.eligible === false
              ? <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              : <HelpCircle size={13} className="shrink-0 mt-0.5 text-gray-400" />}
          <span>
            {migration.eligible === true
              ? 'Existing documents can be migrated to this version.'
              : migration.eligible === false
                ? 'Existing documents are not automatically migratable.'
                : 'Migration eligibility unknown.'}
            {migration.reason && <span className="text-gray-500"> {migration.reason}.</span>}
            {migration.via && (
              <span className="inline-flex items-center gap-1 ml-1 text-gray-500">
                <ArrowRight size={10} /> <code className="font-mono">{migration.via}</code>
              </span>
            )}
          </span>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Existing documents stay on their pinned version until migrated — nothing changed automatically.
      </p>
    </div>
  )
}
