import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTemplates, useWipClient } from '@wip/react'
import type { Template, TemplateUsage } from '@wip/client'

// ---------------------------------------------------------------------------
// Cross-namespace template discovery
//
// A document's namespace is independent of its template's namespace:
// `POST /documents` takes both and WIP does not require them to match, so a
// document in namespace A can be an instance of a template owned by
// namespace B. `GET /templates?namespace=A` does NOT return that template,
// which used to make such documents unreachable in the console.
//
// `GET /documents/template-facets` (CASE-739, which RC filed and the platform
// shipped in @wip/client 0.47.0) answers the inverse question directly: it
// groups the namespace's own documents by template, carrying each template's
// OWN namespace and a distinct-document count.
//
// This replaces an earlier workaround that derived the same set from the
// reporting inventory. That version had three defects the facet endpoint
// removes outright: templates with reporting sync disabled were invisible,
// the inventory lagged document writes, and it yielded a lowercased table
// stem that had to be guessed back into a template value. Counts here are
// exact and live.
// ---------------------------------------------------------------------------

export interface ExternalTemplate {
  template_id: string
  value: string
  label?: string | null
  /** The template's OWN namespace — by construction not the selected one. */
  namespace: string
  version?: number | null
  usage?: TemplateUsage
  header_fields?: string[]
  identity_fields?: string[]
  fields?: unknown[] | null
  /** Distinct logical documents in the selected namespace on this template. */
  document_count: number
  external: true
}

export interface ExternalTemplatesResult {
  /** Foreign templates that documents in this namespace are instances of. */
  externals: ExternalTemplate[]
  /**
   * Facets we could not match to a template definition — a template deleted
   * out from under its documents. Surfaced so the UI can be honest instead of
   * silently dropping them.
   */
  unresolved: string[]
  isLoading: boolean
}

const EMPTY: ExternalTemplatesResult = { externals: [], unresolved: [], isLoading: false }

/**
 * Templates referenced by documents in `namespace` but not owned by it.
 *
 * `ownTemplates` is the already-fetched `GET /templates?namespace=` result;
 * it is used only to avoid re-listing what the caller already has.
 */
export function useExternalTemplates(
  namespace: string,
  ownTemplates: Template[],
): ExternalTemplatesResult {
  const client = useWipClient()

  // "All namespaces" already queries documents unscoped, so nothing is hidden
  // and there is nothing to reconcile.
  const { data: facetData, isLoading: facetsLoading } = useQuery({
    queryKey: ['rc-console', 'template-facets', namespace],
    queryFn: () => client.documents.getTemplateFacets({ namespace }),
    enabled: Boolean(namespace),
    staleTime: 60_000,
  })

  // A facet whose template belongs to another namespace is the whole point.
  // `template_namespace: null` means the platform could not fetch the
  // template — treat it as foreign rather than hiding it, since it is
  // definitely not in this namespace's own listing.
  const foreign = useMemo(() => {
    if (!namespace || !facetData) return []
    const ownIds = new Set(ownTemplates.map(t => t.template_id))
    return facetData.facets.filter(
      f => f.template_namespace !== namespace && !ownIds.has(f.template_id),
    )
  }, [namespace, facetData, ownTemplates])

  // Only pay for the global template list when there is something to resolve.
  // Matching is by template_id, so it is exact — no value/stem guessing.
  const needsResolve = foreign.length > 0
  const { data: allTemplates, isLoading: templatesLoading } = useTemplates({
    status: 'active',
    latest_only: true,
    page_size: 200,
  }, { enabled: needsResolve })

  return useMemo(() => {
    if (!needsResolve) return facetsLoading ? { ...EMPTY, isLoading: true } : EMPTY
    if (!allTemplates) return { ...EMPTY, isLoading: true }

    const byId = new Map(allTemplates.items.map(t => [t.template_id, t]))
    const externals: ExternalTemplate[] = []
    const unresolved: string[] = []

    for (const facet of foreign) {
      const t = byId.get(facet.template_id)
      if (!t) {
        unresolved.push(facet.template_value ?? facet.template_id)
        continue
      }
      externals.push({
        template_id: t.template_id,
        value: t.value,
        label: t.label,
        namespace: t.namespace,
        version: t.version,
        usage: t.usage,
        header_fields: t.header_fields,
        identity_fields: t.identity_fields,
        fields: t.fields,
        document_count: facet.document_count,
        external: true,
      })
    }
    externals.sort((a, b) => a.value.localeCompare(b.value))

    return { externals, unresolved, isLoading: templatesLoading }
  }, [needsResolve, allTemplates, foreign, facetsLoading, templatesLoading])
}
