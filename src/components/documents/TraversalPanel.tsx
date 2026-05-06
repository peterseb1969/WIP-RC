import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, AlertTriangle, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, FileText } from 'lucide-react'
import { useTraverseDocuments, useTemplates } from '@wip/react'
import type { DocumentTraverseNode } from '@wip/client'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// TraversalPanel — BFS expansion through the relationship graph from a seed.
//
// CASE-297 v2 surface 2. Backed by GET /documents/{id}/traverse
// (typed via @wip/react@0.10.0 useTraverseDocuments hook). Server enforces
// depth ≤ 10 and node ceiling = 1000; exposes truncated flag if either
// trips.
// ---------------------------------------------------------------------------

type Direction = 'outgoing' | 'incoming' | 'both'

export interface TraversalPanelProps {
  documentId: string
  namespace?: string
}

export default function TraversalPanel({ documentId, namespace }: TraversalPanelProps) {
  const [depth, setDepth] = useState(2)
  const [direction, setDirection] = useState<Direction>('outgoing')
  const [edgeTypes, setEdgeTypes] = useState<string[]>([])

  // Pull edge-type templates for the type filter
  const { data: templatesData } = useTemplates({ status: 'active', latest_only: true, page_size: 200 })
  const edgeTypeOptions = (templatesData?.items ?? [])
    .filter(t => t.usage === 'relationship')
    .map(t => ({ value: t.value, label: t.label || t.value }))

  const { data, isLoading, error, refetch } = useTraverseDocuments(
    documentId,
    {
      depth,
      direction,
      types: edgeTypes.length > 0 ? edgeTypes.join(',') : undefined,
      namespace,
    },
  )

  const nodes = data?.nodes ?? []
  // Drop the seed (depth=0) — the seed is THIS doc, no need to render it.
  const reachableNodes = nodes.filter(n => n.depth > 0)

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-end gap-3 flex-wrap text-xs bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Depth: <span className="font-mono text-gray-700">{depth}</span></span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={depth}
            onChange={e => setDepth(Number(e.target.value))}
            className="w-32"
          />
        </label>
        <div>
          <span className="block text-gray-500 mb-1">Direction</span>
          <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
            <DirectionChip label="Out" icon={<ArrowUpRight size={11} />} active={direction === 'outgoing'} onClick={() => setDirection('outgoing')} />
            <DirectionChip label="In" icon={<ArrowDownLeft size={11} />} active={direction === 'incoming'} onClick={() => setDirection('incoming')} />
            <DirectionChip label="Both" icon={<ArrowLeftRight size={11} />} active={direction === 'both'} onClick={() => setDirection('both')} />
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:bg-white disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={11} className="animate-spin" /> : null}
          Run
        </button>
      </div>

      {/* Edge-type multi-select (compact checkbox grid) */}
      {edgeTypeOptions.length > 0 && (
        <div className="text-xs">
          <div className="text-gray-500 mb-1">Edge types ({edgeTypes.length === 0 ? 'all' : `${edgeTypes.length} selected`})</div>
          <div className="flex flex-wrap gap-1.5">
            {edgeTypeOptions.map(o => {
              const on = edgeTypes.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setEdgeTypes(prev => on ? prev.filter(x => x !== o.value) : [...prev, o.value])}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-mono',
                    on
                      ? 'bg-purple-50 border-purple-200 text-purple-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                  )}
                >
                  {o.value}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Status / errors */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-500 px-3 py-4 justify-center">
          <Loader2 size={12} className="animate-spin" /> Traversing…
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{(error as Error).message}</span>
        </div>
      )}

      {data?.truncated && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Traversal hit a server cap (depth ≤ 10, ≤ 1000 nodes). Some nodes are not in the result.
            Consider narrowing the edge-type filter or reducing depth.
          </span>
        </div>
      )}

      {/* Results: flat indented list grouped by depth */}
      {!isLoading && !error && reachableNodes.length === 0 && (
        <p className="text-xs text-gray-400 px-3 py-4 text-center">
          No {direction === 'both' ? '' : direction + ' '}reachable nodes within depth {depth}.
        </p>
      )}

      {reachableNodes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500">
            {reachableNodes.length} node{reachableNodes.length === 1 ? '' : 's'} reached (excl. seed).
            {data && (
              <span className="ml-2">
                Total: {data.total_nodes}, depth: {data.depth}, direction: {data.direction}
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {reachableNodes.map(n => (
              <TraversalNodeRow key={`${n.document_id}-${n.depth}`} node={n} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TraversalNodeRow({ node }: { node: DocumentTraverseNode }) {
  const tv = node.template_value || '_'
  return (
    <div
      className="px-4 py-2 flex items-center gap-3 text-xs hover:bg-gray-50"
      style={{ paddingLeft: `${16 + (node.depth - 1) * 16}px` }}
    >
      <span className="text-[10px] font-mono text-gray-400 shrink-0">d={node.depth}</span>
      <FileText size={12} className="text-gray-400 shrink-0" />
      <Link
        to={`/documents/${tv}/${node.document_id}`}
        className="text-gray-800 hover:text-blue-600 hover:underline font-mono truncate"
      >
        {node.document_id.slice(0, 12)}…
      </Link>
      {node.template_value && (
        <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
          {node.template_value}
        </span>
      )}
      <span className="text-[10px] text-gray-400 shrink-0 ml-auto">
        ns: <span className="font-mono">{node.namespace}</span>
      </span>
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
        'inline-flex items-center gap-1 px-2 py-1.5 transition-colors',
        active ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
