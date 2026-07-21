import { useMemo } from 'react'
import { useTemplates } from '@wip/react'
import type { Template, TemplateUsage } from '@wip/client'
import { useReportingInventory } from '@/hooks/use-reporting'

// ---------------------------------------------------------------------------
// Cross-namespace template discovery
//
// A document's namespace is independent of its template's namespace:
// `POST /documents` takes both and WIP does not require them to match, so a
// document in namespace A can be an instance of a template owned by
// namespace B. `GET /templates?namespace=A` does NOT return that template,
// which used to make such documents unreachable in the console — the
// template dropdown was built purely from the namespace's own templates.
//
// The reporting layer already knows the answer. It materialises each
// document row into a PG schema named after the *document's* namespace, in
// a view named after its *template*. So the reporting inventory — which RC
// already fetches and caches globally in useReportingInventory() — tells us
// exactly which templates a namespace's documents actually reference.
//
// Known limits, surfaced in the UI rather than hidden:
//   - templates with `reporting.sync_enabled: false` never appear here
//   - the inventory lags document writes (sync is NATS-driven)
//   - the inventory yields a lowercased *table stem*, not a template value,
//     and the stem is not directly queryable — `template_value=library_doc`
//     matches nothing because the filter is case-sensitive. Hence the
//     resolve step below, which maps stems back to real templates.
//
// The resolve step fetches the global template list, so it is gated behind
// "are there actually any foreign stems?" — in the common case (no
// cross-namespace documents) it never runs.
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
  /** Document count from the reporting inventory (may lag). */
  row_count: number
  external: true
}

export interface ExternalTemplatesResult {
  /** Foreign templates that documents in this namespace are instances of. */
  externals: ExternalTemplate[]
  /**
   * Reporting stems we could not map back to a template — a template that
   * was deleted, or one whose custom `reporting.table_name` we could not
   * invert. Surfaced so the UI can be honest instead of silently dropping.
   */
  unresolved: string[]
  isLoading: boolean
}

const EMPTY: ExternalTemplatesResult = { externals: [], unresolved: [], isLoading: false }

/** Reporting relations are named `doc_<stem>`; strip the prefix to compare. */
function stripDocPrefix(name: string): string {
  return name.startsWith('doc_') ? name.slice(4) : name
}

/**
 * The stems a template could plausibly own: its value normalised the way
 * the reporting layer names tables, plus any explicit table_name override.
 */
function stemsFor(t: Template): string[] {
  const stems = [t.value.toLowerCase()]
  const custom = t.reporting?.table_name
  if (custom) stems.push(stripDocPrefix(custom.toLowerCase()))
  return stems
}

/**
 * Templates referenced by documents in `namespace` but not owned by it.
 *
 * `ownTemplates` is the already-fetched `GET /templates?namespace=` result;
 * passing it in avoids a second copy of that query and lets us subtract it
 * from the inventory without another round trip.
 */
export function useExternalTemplates(
  namespace: string,
  ownTemplates: Template[],
): ExternalTemplatesResult {
  const { data: inventory, isLoading: inventoryLoading } = useReportingInventory()

  // Stems the reporting layer attributes to this namespace's documents.
  const foreignStems = useMemo(() => {
    // "All namespaces" already queries documents unscoped, so nothing is
    // hidden and there is nothing to reconcile.
    if (!namespace || !inventory) return []

    // Entity rows are one-per-template and carry the true document count.
    // Fall back to the flat table list on pre-CASE-710 installs, where we
    // must skip the `__v<N>` / `__entities` siblings by hand and keep only
    // the bare-name view.
    const rows: Array<{ stem: string; row_count: number }> = inventory.entities.length
      ? inventory.entities
          .filter(e => e.namespace === namespace)
          .map(e => ({ stem: e.entity.toLowerCase(), row_count: e.row_count }))
      : inventory.tables
          .filter(t => t.namespace === namespace && t.template_value)
          .filter(t => t.name === `doc_${t.template_value}`)
          .map(t => ({ stem: t.template_value.toLowerCase(), row_count: t.row_count }))

    const own = new Set(ownTemplates.flatMap(stemsFor))
    // row_count 0 means the mirror relation the platform creates in the
    // template's own namespace — no documents, nothing to browse.
    return rows.filter(r => r.row_count > 0 && !own.has(r.stem))
  }, [namespace, inventory, ownTemplates])

  // Only pay for the global template list when there is something to resolve.
  const needsResolve = foreignStems.length > 0
  const { data: allTemplates, isLoading: templatesLoading } = useTemplates({
    status: 'active',
    latest_only: true,
    page_size: 200,
  }, { enabled: needsResolve })

  return useMemo(() => {
    if (!needsResolve) return inventoryLoading ? { ...EMPTY, isLoading: true } : EMPTY
    if (!allTemplates) return { ...EMPTY, isLoading: true }

    const byStem = new Map<string, Template>()
    for (const t of allTemplates.items) {
      for (const stem of stemsFor(t)) {
        if (!byStem.has(stem)) byStem.set(stem, t)
      }
    }

    const externals: ExternalTemplate[] = []
    const unresolved: string[] = []
    for (const { stem, row_count } of foreignStems) {
      const t = byStem.get(stem)
      if (!t) {
        unresolved.push(stem)
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
        row_count,
        external: true,
      })
    }
    externals.sort((a, b) => a.value.localeCompare(b.value))

    return { externals, unresolved, isLoading: templatesLoading }
  }, [needsResolve, allTemplates, foreignStems, inventoryLoading, templatesLoading])
}
