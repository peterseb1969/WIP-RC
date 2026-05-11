import type { PeerProjection } from '@wip/client'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// PeerHeader — compact header-fields-driven renderer for peer/document
// summaries. Used in relationship sidebars, traversal nodes, and anywhere a
// "what's important about this doc at a glance" rendering is needed.
//
// CASE-347 Phase 2 / Gap B — consumes Template.header_fields (declared on
// the peer template via CASE-343) by reading projected values from the
// PeerProjection.data + .metadata.custom maps.
//
// Two consumption modes:
//   (a) From a peer projection (?include=peers on relationships endpoint)
//       — pass `peer={...}`.
//   (b) From a hydrated full Document + its Template — pass
//       `data={...}`, `metadata={...}`, `headerFields={...}`.
// Both produce the same visual: primary label (first non-empty header
// field) + secondary pills for the rest. Falls back to the `fallbackLabel`
// when no header fields resolve.
// ---------------------------------------------------------------------------

export interface PeerHeaderProps {
  /** Peer projection from getDocumentRelationships(?include=peers). */
  peer?: PeerProjection | null
  /**
   * Alternative inputs when you have a fully-hydrated Document + its
   * template — e.g., from useDocument + useTemplate.
   */
  data?: Record<string, unknown>
  metadata?: Record<string, unknown>
  headerFields?: string[]
  /**
   * Identity fields — used as the fallback when headerFields is empty
   * (mirrors the platform's CASE-343 Phase 1 option-a fallback so the UI
   * shows the same projection the server would produce).
   */
  identityFields?: string[]
  /** Last-resort label (e.g., lookup_value, doc id prefix). */
  fallbackLabel: string
  /** Compact mode — single line, fewer secondary pills. */
  compact?: boolean
  className?: string
}

/** Project a single header-field path against data + metadata. */
function projectPath(
  path: string,
  data: Record<string, unknown>,
  metadata?: { custom?: Record<string, unknown> } | Record<string, unknown> | null,
): unknown {
  if (path.startsWith('metadata.custom.')) {
    const name = path.slice('metadata.custom.'.length)
    const custom = (metadata as { custom?: Record<string, unknown> } | undefined)?.custom
    return custom?.[name]
  }
  // Support nested data paths like `data.foo` or just `foo`.
  const clean = path.startsWith('data.') ? path.slice('data.'.length) : path
  // dotted paths: walk the object
  const parts = clean.split('.')
  let cur: unknown = data
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return cur
}

function formatValue(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

export default function PeerHeader({
  peer,
  data,
  metadata,
  headerFields,
  identityFields,
  fallbackLabel,
  compact = false,
  className,
}: PeerHeaderProps) {
  // Choose the data source: peer projection > explicit data+metadata.
  const effectiveData = peer?.data ?? data ?? {}
  const effectiveMetadata = peer?.metadata ?? metadata ?? null
  // The peer projection has the server's already-projected fields, so we
  // don't need headerFields when peer is supplied — peer.data is the
  // projection. But we do need the original headerFields to know the
  // PATH ORDER for ordering pills. When peer is supplied, fall back to
  // Object.keys(peer.data) order (the server projects in declaration order).
  const paths = (() => {
    if (peer) {
      const fromData = Object.keys(peer.data)
      const fromMeta = peer.metadata?.custom
        ? Object.keys(peer.metadata.custom).map(k => `metadata.custom.${k}`)
        : []
      return [...fromData, ...fromMeta]
    }
    const explicit = headerFields ?? []
    return explicit.length > 0 ? explicit : (identityFields ?? [])
  })()

  const projected = paths
    .map(p => ({ path: p, value: projectPath(p, effectiveData as Record<string, unknown>, effectiveMetadata as Record<string, unknown> | null) }))
    .filter(({ value }) => value != null && value !== '')

  if (projected.length === 0) {
    return (
      <span className={cn('text-sm text-gray-800 truncate', className)}>
        {fallbackLabel}
      </span>
    )
  }

  const primary = projected[0]
  const secondary = projected.slice(1)
  const maxSecondary = compact ? 1 : 3
  const visibleSecondary = secondary.slice(0, maxSecondary)
  const overflow = secondary.length - visibleSecondary.length

  return (
    <span className={cn('inline-flex items-center gap-2 flex-wrap min-w-0', className)}>
      <span className="text-sm font-medium text-gray-800 truncate">
        {formatValue(primary!.value)}
      </span>
      {visibleSecondary.map(({ path, value }) => (
        <span
          key={path}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-dark truncate max-w-[140px]"
          title={`${path}: ${formatValue(value)}`}
        >
          <span className="font-mono opacity-60">{shortPath(path)}</span>
          <span className="truncate">{formatValue(value)}</span>
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-gray-400">+{overflow}</span>
      )}
    </span>
  )
}

/** Shorten "metadata.custom.case_status" to "case_status" for chip display. */
function shortPath(path: string): string {
  if (path.startsWith('metadata.custom.')) return path.slice('metadata.custom.'.length)
  if (path.startsWith('data.')) return path.slice('data.'.length)
  return path
}
