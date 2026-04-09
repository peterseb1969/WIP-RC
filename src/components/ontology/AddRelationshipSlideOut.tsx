import { useMemo, useState } from 'react'
import { X, Plus, ArrowRight, ArrowLeft } from 'lucide-react'
import { useTerms, useCreateRelationships } from '@wip/react'
import { useQueryClient } from '@tanstack/react-query'
import type { Term } from '@wip/client'
import TermSearchPicker, { type PickedTerm } from './TermSearchPicker'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// AddRelationshipSlideOut — Step 5 of the Ontology UI build.
//
// Right-side slide-out for creating a new relationship from the current term.
// Uses TermSearchPicker to pick the other term (cross-namespace allowed),
// `_ONTOLOGY_RELATIONSHIP_TYPES` for the type dropdown (with hardcoded
// fallback), and a direction toggle that determines which term is the
// source vs target:
//   - outgoing: { source: currentTerm, target: picked }
//   - incoming: { source: picked, target: currentTerm }
//
// On successful create, invalidates the Relationships tab query keys:
//   ['rc-console', 'relationships', termId, 'outgoing' | 'incoming']
//   ['rc-console', 'relationships-count', termId]
// ---------------------------------------------------------------------------

// Fallback list if `_ONTOLOGY_RELATIONSHIP_TYPES` can't be fetched (e.g., the
// system terminology isn't available with the current key's scope).
const FALLBACK_RELATIONSHIP_TYPES = [
  'is_a',
  'has_subtype',
  'part_of',
  'has_part',
  'maps_to',
  'mapped_from',
  'related_to',
  'finding_site',
  'causative_agent',
]

interface AddRelationshipSlideOutProps {
  currentTerm: Term
  onClose: () => void
}

export default function AddRelationshipSlideOut({
  currentTerm,
  onClose,
}: AddRelationshipSlideOutProps) {
  const queryClient = useQueryClient()
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing')
  const [relationshipType, setRelationshipType] = useState<string>('is_a')
  const [picked, setPicked] = useState<PickedTerm | null>(null)

  // Fetch relationship types from the _ONTOLOGY_RELATIONSHIP_TYPES system
  // terminology. We pass the terminology value (not id) — useTerms accepts
  // either. If the fetch fails or returns empty, fall back to the hardcoded list.
  const typesQuery = useTerms('_ONTOLOGY_RELATIONSHIP_TYPES', {
    page_size: 1000,
    status: 'active',
  })

  const relationshipTypes: string[] = useMemo(() => {
    const items = typesQuery.data?.items ?? []
    if (items.length > 0) {
      return items.map(t => t.value).sort()
    }
    return FALLBACK_RELATIONSHIP_TYPES
  }, [typesQuery.data])

  const create = useCreateRelationships({
    onSuccess: response => {
      // BulkResponse may partially fail — leave the panel open so the user
      // sees the error from `bulkError` below.
      if (response.failed > 0) return
      // Invalidate both directions + the count (the new relationship could be
      // incoming or outgoing depending on direction toggle).
      queryClient.invalidateQueries({
        queryKey: ['rc-console', 'relationships', currentTerm.term_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['rc-console', 'relationships-count', currentTerm.term_id],
      })
      // Also invalidate the *other* term's relationship queries — it now has
      // a new incoming/outgoing relationship pointing back here.
      if (picked) {
        queryClient.invalidateQueries({
          queryKey: ['rc-console', 'relationships', picked.term_id],
        })
        queryClient.invalidateQueries({
          queryKey: ['rc-console', 'relationships-count', picked.term_id],
        })
      }
      onClose()
    },
  })

  const handleSave = () => {
    if (!picked) return
    const sourceTermId = direction === 'outgoing' ? currentTerm.term_id : picked.term_id
    const targetTermId = direction === 'outgoing' ? picked.term_id : currentTerm.term_id
    create.mutate({
      items: [
        {
          source_term_id: sourceTermId,
          target_term_id: targetTermId,
          relationship_type: relationshipType,
          created_by: 'rc-console',
        },
      ],
      namespace: currentTerm.namespace,
    })
  }

  // Per-item error from the bulk response (if any)
  const bulkError = create.data?.results.find(r => r.status !== 'success')?.error

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[40%] min-w-[420px] bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col"
        role="dialog"
        aria-label="Add relationship"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-700 inline-flex items-center gap-2">
            <Plus size={14} className="text-blue-500" />
            Add relationship
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Current term summary */}
          <div className="bg-gray-50 border border-gray-100 rounded-md p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">
              From
            </div>
            <div className="text-sm text-gray-800 truncate">
              {currentTerm.label || currentTerm.value}
            </div>
            <div className="text-xs font-mono text-gray-500 truncate">
              {currentTerm.value}
            </div>
          </div>

          {/* Direction toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('outgoing')}
                className={cn(
                  'px-3 py-2 rounded-md border text-xs inline-flex items-center justify-center gap-1.5',
                  direction === 'outgoing'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                <ArrowRight size={12} /> Outgoing
              </button>
              <button
                type="button"
                onClick={() => setDirection('incoming')}
                className={cn(
                  'px-3 py-2 rounded-md border text-xs inline-flex items-center justify-center gap-1.5',
                  direction === 'incoming'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                <ArrowLeft size={12} /> Incoming
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {direction === 'outgoing'
                ? 'This term → other term'
                : 'Other term → this term'}
            </p>
          </div>

          {/* Relationship type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Relationship type
              {typesQuery.isError && (
                <span className="ml-2 text-[10px] text-amber-600">
                  (using fallback list)
                </span>
              )}
            </label>
            <select
              value={relationshipType}
              onChange={e => setRelationshipType(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              disabled={typesQuery.isLoading}
            >
              {relationshipTypes.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Target term picker */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {direction === 'outgoing' ? 'Target term' : 'Source term'}
            </label>
            {picked ? (
              <div className="flex items-start justify-between gap-2 border border-gray-200 rounded-md px-3 py-2 bg-white">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-800 truncate">
                    {picked.label || picked.value}
                  </div>
                  <div className="text-xs font-mono text-gray-500 truncate">
                    {picked.value}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>{picked.terminology_value ?? picked.terminology_id}</span>
                    {picked.namespace !== currentTerm.namespace && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-mono text-[10px]">
                        ns: {picked.namespace}
                      </span>
                    )}
                    {picked.terminology_id !== currentTerm.terminology_id && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-mono text-[10px]">
                        cross-terminology
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 shrink-0"
                  title="Change"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <TermSearchPicker
                namespace={currentTerm.namespace}
                onSelect={setPicked}
                excludeTermIds={[currentTerm.term_id]}
                placeholder="Search terms..."
                autoFocus
              />
            )}
            <p className="text-[11px] text-gray-400 mt-1.5">
              Searching within <span className="font-mono">{currentTerm.namespace}</span>.
              Cross-namespace relationships must be created via API (slide-out currently
              scopes to this term's namespace).
            </p>
          </div>

          {/* Error display */}
          {create.error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {create.error.message}
            </div>
          )}
          {bulkError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {bulkError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50/50 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!picked || create.isPending}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {create.isPending ? 'Adding...' : 'Add relationship'}
          </button>
          <button
            onClick={onClose}
            disabled={create.isPending}
            className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
