import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Network, ArrowUpRight, ArrowDownLeft, Loader2, AlertTriangle } from 'lucide-react'
import { useDocumentRelationships } from '@wip/react'
import type { Document, Reference } from '@wip/client'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// RelationshipsPanel — incoming + outgoing relationship documents touching
// the seed document, grouped by edge type.
//
// CASE-297 v2 surface 1. Backed by GET /documents/{id}/relationships
// (typed via @wip/react@0.10.0 useDocumentRelationships hook).
// ---------------------------------------------------------------------------

type Direction = 'incoming' | 'outgoing' | 'both'

function findRef(refs: Reference[] | undefined, fieldPath: string) {
  return refs?.find(r => r.field_path === fieldPath && r.reference_type === 'document')
}

function templateById(refs: Reference[] | undefined, fallback: string | null | undefined): string | null {
  // best-effort: pull a template_value from references' resolved data
  const tv = refs?.[0]?.resolved?.template_value
  return tv ?? fallback ?? null
}

export interface RelationshipsPanelProps {
  documentId: string
  /** The seed document's namespace — used as the default scope for the query. */
  namespace?: string
}

export default function RelationshipsPanel({ documentId, namespace }: RelationshipsPanelProps) {
  const [direction, setDirection] = useState<Direction>('both')
  const [activeOnly, setActiveOnly] = useState(true)

  const { data, isLoading, error } = useDocumentRelationships(
    documentId,
    {
      direction,
      active_only: activeOnly,
      namespace,
      page_size: 100,
    },
  )

  const items = data?.items ?? []
  const total = data?.total ?? items.length

  // Group by edge type — we read the relationship doc's template_value via
  // `template_value` (denormalised on the wire) or fall back to template_id.
  const groups = useMemo(() => {
    const m = new Map<string, Document[]>()
    for (const d of items) {
      const key = d.template_value || d.template_id
      const list = m.get(key) ?? []
      list.push(d)
      m.set(key, list)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
          <DirectionChip label="Both" active={direction === 'both'} onClick={() => setDirection('both')} />
          <DirectionChip label="Incoming" icon={<ArrowDownLeft size={11} />} active={direction === 'incoming'} onClick={() => setDirection('incoming')} />
          <DirectionChip label="Outgoing" icon={<ArrowUpRight size={11} />} active={direction === 'outgoing'} onClick={() => setDirection('outgoing')} />
        </div>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={e => setActiveOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-600">Active only</span>
        </label>
        <span className="text-gray-400 ml-auto">{total} relationship{total === 1 ? '' : 's'}</span>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-500 px-3 py-4 justify-center">
          <Loader2 size={12} className="animate-spin" /> Loading relationships…
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{(error as Error).message}</span>
        </div>
      )}

      {!isLoading && !error && groups.length === 0 && (
        <p className="text-xs text-gray-400 px-3 py-4 text-center">
          No {direction === 'both' ? '' : direction + ' '}relationships {activeOnly ? '(active)' : ''} for this document.
        </p>
      )}

      {groups.map(([edgeType, rels]) => (
        <div key={edgeType} className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-purple-50/40">
            <Network size={12} className="text-purple-600" />
            <span className="text-xs font-medium font-mono text-purple-800">{edgeType}</span>
            <span className="text-[10px] text-gray-500">{rels.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {rels.map(r => (
              <RelationshipRow key={r.document_id} rel={r} seedDocumentId={documentId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function RelationshipRow({ rel, seedDocumentId }: { rel: Document; seedDocumentId: string }) {
  const data = (rel.data ?? {}) as Record<string, unknown>
  const sourceRefId = String(data.source_ref ?? '')
  const targetRefId = String(data.target_ref ?? '')
  const isOutgoing = sourceRefId === seedDocumentId
  const otherDirection = isOutgoing ? 'outgoing' : 'incoming'
  const otherRefId = isOutgoing ? targetRefId : sourceRefId
  const otherRef = findRef(rel.references, isOutgoing ? 'target_ref' : 'source_ref')
  const otherTemplateValue = otherRef?.resolved?.template_value ?? '_'
  const otherLabel = otherRef?.lookup_value || otherRefId.slice(0, 8) + '…'

  // Edge properties = anything in data besides source_ref / target_ref
  const propEntries = Object.entries(data).filter(([k]) => k !== 'source_ref' && k !== 'target_ref')

  const relTemplateValue = rel.template_value || templateById(rel.references, null) || '_'

  return (
    <div className="px-4 py-2 flex items-start gap-3 text-xs">
      <span className={cn(
        'shrink-0 mt-0.5',
        otherDirection === 'outgoing' ? 'text-blue-500' : 'text-amber-500',
      )}>
        {otherDirection === 'outgoing' ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {otherRefId ? (
            <Link
              to={`/documents/${otherTemplateValue}/${otherRefId}`}
              className="text-sm text-gray-800 hover:text-blue-600 hover:underline truncate"
            >
              {otherLabel}
            </Link>
          ) : (
            <span className="text-sm text-red-600">unresolved</span>
          )}
          <span className="text-[10px] text-gray-400 font-mono">
            ({otherRef?.resolved?.template_value || 'unknown template'})
          </span>
        </div>
        {propEntries.length > 0 && (
          <div className="mt-0.5 text-[11px] text-gray-500 flex items-center gap-3 flex-wrap">
            {propEntries.slice(0, 4).map(([k, v]) => (
              <span key={k} className="truncate max-w-[180px]">
                <span className="text-gray-400">{k}:</span> {formatValue(v)}
              </span>
            ))}
            {propEntries.length > 4 && (
              <span className="text-gray-400">+{propEntries.length - 4} more</span>
            )}
          </div>
        )}
      </div>
      <Link
        to={`/documents/${relTemplateValue}/${rel.document_id}`}
        className="text-[10px] text-gray-400 hover:text-blue-500 shrink-0 mt-0.5"
        title="Open the relationship document"
      >
        edge ↗
      </Link>
    </div>
  )
}

function DirectionChip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon?: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1.5 transition-colors',
        active ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function formatValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v.length > 30 ? v.slice(0, 30) + '…' : v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v).slice(0, 30)
}
