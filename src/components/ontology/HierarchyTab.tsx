import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronDown, Tag, Loader2, ArrowUp, ArrowDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTerms, useWipClient } from '@wip/react'
import type { Term, TermRelation } from '@wip/client'

interface HydratedRelationship {
  rel: TermRelation
  otherTermId: string
  otherValue: string
  otherLabel: string | null
  otherTerminologyId: string
}
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// HierarchyTab — Step 7 of the Ontology UI build.
//
// Lazy-expanding tree view of a term's ancestors (upward) and descendants
// (downward) via `client.defStore.getParents(termId, namespace)` and
// `getChildren(termId, namespace)`. The relationship type is user-selectable;
// default is `is_a`. Results are filtered client-side to the selected type
// so changing the selector re-scopes without re-fetching.
//
// The "parent" or "child" of a term is whichever end of the returned
// relationship isn't the current term — this handles inverse pairs like
// is_a / has_subtype uniformly.
// ---------------------------------------------------------------------------

const FALLBACK_RELATIONSHIP_TYPES = [
  'is_a',
  'has_subtype',
  'part_of',
  'has_part',
  'maps_to',
  'mapped_from',
  'related_to',
]

interface HierarchyTabProps {
  term: Term
}

export default function HierarchyTab({ term }: HierarchyTabProps) {
  const client = useWipClient()
  const [relationshipType, setRelationshipType] = useState('is_a')
  // Track an explicit user choice so the adaptive default below never fights it.
  const [userPicked, setUserPicked] = useState(false)

  // Fetch types from _ONTOLOGY_RELATIONSHIP_TYPES with fallback
  const typesQuery = useTerms('_ONTOLOGY_RELATIONSHIP_TYPES', {
    page_size: 1000,
    status: 'active',
  })
  const relationshipTypes: string[] =
    typesQuery.data?.items && typesQuery.data.items.length > 0
      ? typesQuery.data.items.map(t => t.value).sort()
      : FALLBACK_RELATIONSHIP_TYPES

  // Which relation types does THIS term actually participate in? The tree
  // filters client-side to the single selected type, so defaulting to a type
  // the term doesn't use (the old hardcoded `is_a`) renders an empty tree that
  // looks broken — e.g. a KB_TOPIC term whose relations are all `part_of`.
  // Discover the present types once and steer the default toward one of them.
  const presentQuery = useQuery({
    queryKey: ['rc-console', 'hierarchy-present-types', term.term_id, term.namespace],
    queryFn: async () => {
      const res = await client.defStore.listTermRelations({
        term_id: term.term_id,
        direction: 'both',
        namespace: term.namespace,
        page_size: 200,
      })
      return Array.from(new Set(res.items.map(r => r.relation_type))).sort()
    },
    staleTime: 30_000,
  })
  const presentTypes = presentQuery.data ?? []

  // Steer the initial selection to a type the term uses — `is_a` when present
  // (the usual taxonomic backbone), otherwise the first present type. Only
  // until the user picks explicitly, so their choice is never overridden.
  useEffect(() => {
    if (userPicked || presentTypes.length === 0) return
    if (presentTypes.includes(relationshipType)) return
    setRelationshipType(presentTypes.includes('is_a') ? 'is_a' : presentTypes[0]!)
  }, [presentTypes, userPicked, relationshipType])

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <label className="text-xs font-medium text-gray-600">Relationship type</label>
        <select
          value={relationshipType}
          onChange={e => { setUserPicked(true); setRelationshipType(e.target.value) }}
          className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light"
          disabled={typesQuery.isLoading}
        >
          {relationshipTypes.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {typesQuery.isError && (
          <span className="text-[10px] text-amber-600">(using fallback list)</span>
        )}
        {/* Name the types the term actually uses, so an empty tree for the
            selected type reads as "wrong filter", not "broken". */}
        {presentTypes.length > 0 && (
          <span className="text-[11px] text-gray-400">
            this term uses:{' '}
            {presentTypes.map((t, i) => (
              <button
                key={t}
                type="button"
                onClick={() => { setUserPicked(true); setRelationshipType(t) }}
                className={cn(
                  'font-mono hover:underline',
                  t === relationshipType ? 'text-primary-dark' : 'text-gray-500',
                )}
              >
                {i > 0 && <span className="text-gray-300 no-underline">, </span>}
                {t}
              </button>
            ))}
          </span>
        )}
        {presentQuery.isSuccess && presentTypes.length === 0 && (
          <span className="text-[11px] text-gray-400">no relations on this term</span>
        )}
      </div>

      {/* Parents tree */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5">
          <ArrowUp size={14} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Parents (ancestors)</h3>
        </div>
        <div className="py-1">
          <TreeNode
            termId={term.term_id}
            namespace={term.namespace}
            label={term.label || term.value}
            value={term.value}
            terminologyId={term.terminology_id}
            direction="up"
            relationshipType={relationshipType}
            depth={0}
            isRoot
            defaultExpanded
          />
        </div>
      </div>

      {/* Children tree */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5">
          <ArrowDown size={14} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Children (descendants)</h3>
        </div>
        <div className="py-1">
          <TreeNode
            termId={term.term_id}
            namespace={term.namespace}
            label={term.label || term.value}
            value={term.value}
            terminologyId={term.terminology_id}
            direction="down"
            relationshipType={relationshipType}
            depth={0}
            isRoot
            defaultExpanded
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TreeNode — one row in either tree. Fetches its own one-level relationships
// when expanded (via React Query, so it caches per term_id+direction).
// ---------------------------------------------------------------------------

interface TreeNodeProps {
  termId: string
  namespace: string
  label: string
  value: string
  terminologyId: string
  direction: 'up' | 'down'
  relationshipType: string
  depth: number
  isRoot?: boolean
  defaultExpanded?: boolean
}

function TreeNode({
  termId,
  namespace,
  label,
  value,
  terminologyId,
  direction,
  relationshipType,
  depth,
  isRoot,
  defaultExpanded,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const client = useWipClient()

  // Fetch one level + hydrate the "other end" term for each relationship.
  //
  // relation_type is REQUIRED on the wire: /ontology/terms/{id}/parents and
  // /children return an empty array when it is omitted, so the earlier
  // "fetch all types, filter client-side" approach always came back empty for
  // any term (that was the KB_TOPIC / part_of "hierarchy doesn't render" bug).
  // Pass the selected type through and let the server scope it; the query key
  // includes it so switching the selector re-fetches.
  //
  // getParents/getChildren may not populate the denormalized
  // source/target_term_label fields, so we hydrate via getTerm in parallel
  // to get human-readable labels and the correct terminology_id for the link.
  const query = useQuery<HydratedRelationship[]>({
    queryKey: ['rc-console', 'hierarchy', direction, termId, namespace, relationshipType],
    queryFn: async () => {
      const params = { namespace, relation_type: relationshipType }
      const raw =
        direction === 'up'
          ? await client.defStore.getParents(termId, params)
          : await client.defStore.getChildren(termId, params)
      const hydrated = await Promise.all(
        raw.map(async (rel): Promise<HydratedRelationship> => {
          const isSource = rel.source_term_id === termId
          const otherTermId = isSource ? rel.target_term_id : rel.source_term_id
          const denormValue = isSource ? rel.target_term_value : rel.source_term_value
          const denormLabel = isSource ? rel.target_term_label : rel.source_term_label
          const denormTerminologyId = isSource
            ? rel.target_terminology_id
            : rel.source_terminology_id
          // If we already have a label and value, skip the hydration call.
          if (denormLabel && denormValue && denormTerminologyId) {
            return {
              rel,
              otherTermId,
              otherValue: denormValue,
              otherLabel: denormLabel,
              otherTerminologyId: denormTerminologyId,
            }
          }
          try {
            const full = await client.defStore.getTerm(otherTermId)
            return {
              rel,
              otherTermId,
              otherValue: full.value,
              otherLabel: full.label ?? denormLabel ?? null,
              otherTerminologyId: full.terminology_id,
            }
          } catch {
            return {
              rel,
              otherTermId,
              otherValue: denormValue ?? '',
              otherLabel: denormLabel ?? null,
              otherTerminologyId: denormTerminologyId ?? terminologyId,
            }
          }
        })
      )
      return hydrated
    },
    enabled: expanded,
    staleTime: 30_000,
  })

  // The server already scoped to relationshipType, so this is the whole set.
  const children = query.data ?? []

  const hasChildren = children.length > 0
  const indent = depth * 16

  return (
    <div>
      <div
        className={cn(
          'px-3 py-1.5 flex items-center gap-1.5 hover:bg-gray-50',
          isRoot && 'bg-primary/5/30'
        )}
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="p-0.5 text-gray-400 hover:text-gray-600 shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Tag size={12} className={cn('shrink-0', isRoot ? 'text-primary-light' : 'text-gray-300')} />
        {isRoot ? (
          <span className="text-sm font-medium text-gray-800 truncate">{label}</span>
        ) : (
          <Link
            to={`/terminologies/${terminologyId}/terms/${termId}`}
            className="text-sm text-gray-800 hover:text-primary hover:underline truncate"
          >
            {label}
          </Link>
        )}
        <span className="text-xs font-mono text-gray-400 truncate">{value}</span>
        {expanded && query.isFetching && (
          <Loader2 size={12} className="text-gray-400 animate-spin shrink-0" />
        )}
        {expanded && !query.isFetching && hasChildren && (
          <span className="text-[10px] text-gray-400 shrink-0">({children.length})</span>
        )}
      </div>

      {expanded && (
        <>
          {query.isError && (
            <div
              className="px-3 py-1.5 text-xs text-danger"
              style={{ paddingLeft: `${32 + indent}px` }}
            >
              {(query.error as Error).message}
            </div>
          )}
          {!query.isLoading && !query.isError && !hasChildren && (
            <div
              className="px-3 py-1.5 text-xs text-gray-400"
              style={{ paddingLeft: `${32 + indent}px` }}
            >
              {direction === 'up' ? 'No parents' : 'No children'} for{' '}
              <span className="font-mono">{relationshipType}</span>
            </div>
          )}
          {children.map(({ rel, otherTermId, otherValue, otherLabel, otherTerminologyId }) => (
            <TreeNode
              key={`${rel.source_term_id}-${rel.target_term_id}-${rel.relation_type}`}
              termId={otherTermId}
              namespace={namespace}
              label={otherLabel || otherValue || otherTermId}
              value={otherValue}
              terminologyId={otherTerminologyId}
              direction={direction}
              relationshipType={relationshipType}
              depth={depth + 1}
            />
          ))}
        </>
      )}
    </div>
  )
}
