import { AlertTriangle } from 'lucide-react'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'

interface NamespaceMismatchBadgeProps {
  /** The namespace the shown entity lives in. */
  namespace?: string | null
}

/**
 * Amber pill for detail pages: says when the entity shown is not in the
 * namespace selected in the top bar. A detail page always shows its entity in
 * the entity's own namespace (the selector is disabled there), so without this
 * a link from another namespace's list lands silently. Renders nothing when
 * "All namespaces" is selected or the namespaces match.
 */
export default function NamespaceMismatchBadge({ namespace }: NamespaceMismatchBadgeProps) {
  const { namespace: selected } = useNamespaceFilter()
  if (!selected || !namespace || namespace === selected) return null
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
      title={`Selected in the top bar: ${selected}. This page shows the item in its own namespace, ${namespace}.`}
    >
      <AlertTriangle size={10} />
      not in selected namespace {selected}
    </span>
  )
}
