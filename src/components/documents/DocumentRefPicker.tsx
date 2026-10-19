import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useTemplates, useWipClient } from '@wip/react'
import { WipNotFoundError } from '@wip/client'
import type { Document, FieldDefinition, Template } from '@wip/client'
import { documentLabel } from '@/lib/document-label'
import { referenceNamespaces, resolveTargetTemplate } from '@/lib/reference-targets'
import RefCombobox, { RefFooterNote, type RefItem } from './RefCombobox'

// ---------------------------------------------------------------------------
// DocumentRefPicker — picker for a `reference` field with reference_type
// 'document'. Stores the chosen document's id.
//
// Candidates are the active documents of EVERY template in the field's
// `target_templates` (any template when the list is empty), in every
// namespace the document may reference into: its own, `wip` when its
// namespace is open, and its `allowed_external_refs`. The platform refuses a
// reference into any other namespace, so those are never offered. An edge
// type's endpoints (ownNamespaceOnly) are offered from its own namespace only.
//
// With the search box empty the list shows the BROWSE_SIZE most recently
// updated candidates per namespace. Typing runs the platform's document
// search (reporting-sync, substring over every column) per namespace and
// target template, then loads the matching documents themselves. Search sees
// a document once reporting-sync has it (normally within seconds), and only
// for templates synced to reporting.
//
// Each document is named by its template's header fields, else its identity
// fields (documentLabel). A stored id outside the loaded list is fetched on
// its own, so an existing document shows its target rather than "not found".
// ---------------------------------------------------------------------------

/** Most candidates listed per namespace before the user types. */
const BROWSE_SIZE = 100
/** Most matches one search returns: the search endpoint's per-type maximum. */
const SEARCH_SIZE = 100
const DEBOUNCE_MS = 300

export interface DocumentRefPickerProps {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  /** The referring document's namespace. */
  namespace?: string
  /** Offer documents from `namespace` only: an edge's endpoints must share its namespace. */
  ownNamespaceOnly?: boolean
  id?: string
}

/** Searchable picker over the documents a document reference field may point to (see header above). */
export default function DocumentRefPicker({ field, value, onChange, disabled, namespace, ownNamespaceOnly, id }: DocumentRefPickerProps) {
  const client = useWipClient()
  const targets = field.target_templates ?? []

  const { data: templatesData, isSuccess: templatesLoaded } = useTemplates({ status: 'active', latest_only: true, page_size: 1000 })
  const templateById = useMemo(
    () => new Map((templatesData?.items ?? []).map((t) => [t.template_id, t])),
    [templatesData],
  )
  const { resolved, unresolved } = useMemo(() => {
    const found = new Map<string, Template>()
    const missing: string[] = []
    for (const t of targets) {
      const r = resolveTargetTemplate(t, templatesData?.items ?? [], namespace)
      if (r) found.set(r.template_id, r)
      else missing.push(t)
    }
    return { resolved: [...found.values()], unresolved: missing }
  }, [targets, templatesData, namespace])
  const targetIds = useMemo(() => resolved.map((t) => t.template_id), [resolved])
  const notSynced = resolved.filter((t) => t.reporting?.sync_enabled === false)

  const nsConfig = useQuery({
    queryKey: ['rc-console', 'namespace-config', namespace],
    queryFn: () => client.registry.getNamespace(namespace!),
    enabled: !!namespace && !ownNamespaceOnly,
    retry: false,
    staleTime: 60_000,
  })
  // `undefined` scope = no namespace filter (a caller that knows no namespace).
  const scopes: Array<string | undefined> = useMemo(
    () => (!namespace ? [undefined] : ownNamespaceOnly ? [namespace] : referenceNamespaces(namespace, nsConfig.data)),
    [namespace, ownNamespaceOnly, nsConfig.data],
  )

  const ready =
    templatesLoaded &&
    (targets.length === 0 || resolved.length > 0) &&
    (!namespace || ownNamespaceOnly || !nsConfig.isLoading)
  const templateFilter = targetIds.length > 0 ? [{ field: 'template_id', operator: 'in' as const, value: targetIds }] : []

  const browse = useQueries({
    queries: scopes.map((ns) => ({
      queryKey: ['rc-console', 'ref-browse', ns ?? '_all', targetIds],
      queryFn: () =>
        client.documents.queryDocuments(
          { filters: templateFilter, status: 'active', page_size: BROWSE_SIZE, sort_by: 'updated_at', sort_order: 'desc' },
          ns,
        ),
      enabled: ready,
      staleTime: 30_000,
    })),
  })
  const browseLoading = !ready || browse.some((q) => q.isLoading)
  const browseError = browse.find((q) => q.error)?.error
  const browseDocs = browse
    .flatMap((q) => q.data?.items ?? [])
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  const browseTotal = browse.reduce((n, q) => n + (q.data?.total ?? 0), 0)

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const searchQ = useQuery({
    queryKey: ['rc-console', 'ref-search', scopes, targetIds, debounced],
    queryFn: async (): Promise<{ docs: Document[]; total: number }> => {
      const templates: Array<Template | undefined> = resolved.length > 0 ? resolved : [undefined]
      const responses = await Promise.all(
        scopes.flatMap((ns) =>
          templates.map((t) =>
            client.reporting.search({
              query: debounced,
              types: ['document'],
              namespace: ns,
              template: t?.value,
              mode: 'substring',
              page_size: SEARCH_SIZE,
            }),
          ),
        ),
      )
      const total = responses.reduce((n, r) => n + (r.results.document?.total ?? 0), 0)
      const ids = [...new Set(responses.flatMap((r) => (r.results.document?.items ?? []).map((i) => i.id)))].slice(0, SEARCH_SIZE)
      if (ids.length === 0) return { docs: [], total }
      // Load the hits themselves; the template filter also drops a hit from a
      // same-named template in another namespace.
      const loaded = await Promise.all(
        scopes.map((ns) =>
          client.documents.queryDocuments(
            { filters: [{ field: 'document_id', operator: 'in', value: ids }, ...templateFilter], status: 'active', page_size: SEARCH_SIZE },
            ns,
          ),
        ),
      )
      const byId = new Map(loaded.flatMap((r) => r.items).map((d) => [d.document_id, d]))
      return { docs: ids.map((i) => byId.get(i)).filter((d): d is Document => !!d), total }
    },
    enabled: ready && debounced.length > 0,
    staleTime: 30_000,
  })

  const valueStr = typeof value === 'string' ? value : ''
  const searching = search.trim().length > 0
  const shown = searching ? searchQ.data?.docs ?? [] : browseDocs
  const listed = browseDocs.find((d) => d.document_id === valueStr) ?? searchQ.data?.docs.find((d) => d.document_id === valueStr)
  const valueQ = useQuery({
    queryKey: ['rc-console', 'ref-value', valueStr, namespace],
    queryFn: () => client.documents.getDocument(valueStr, undefined, namespace),
    enabled: !!valueStr && !listed && !browseLoading,
    retry: false,
    staleTime: 60_000,
  })
  const selectedDoc = listed ?? valueQ.data

  const toItem = (d: Document): RefItem => ({
    id: d.document_id,
    value: d.document_id,
    label: documentLabel(d, templateById.get(d.template_id)),
    subLabel: [d.template_value, d.namespace !== namespace ? d.namespace : null].filter(Boolean).join(' · '),
    icon: <FileText size={12} className="text-gray-400 shrink-0" />,
  })

  const searchSettling = searching && (debounced !== search.trim() || searchQ.isFetching)
  const listError = searching ? searchQ.error : browseError

  const notes: React.ReactNode[] = []
  if (unresolved.length > 0 && templatesLoaded) {
    notes.push(
      <RefFooterNote key="unresolved" warn>
        Target template{unresolved.length > 1 ? 's' : ''} {unresolved.join(', ')} not found; no documents are offered for {unresolved.length > 1 ? 'them' : 'it'}.
      </RefFooterNote>,
    )
  }
  if (!searching && browseTotal > browseDocs.length) {
    notes.push(
      <RefFooterNote key="browse">
        Showing the {browseDocs.length} most recently updated of {browseTotal} documents. Type to search all of them.
      </RefFooterNote>,
    )
  }
  if (searching && !searchSettling && searchQ.data && searchQ.data.total > searchQ.data.docs.length) {
    notes.push(
      <RefFooterNote key="search">
        Showing {searchQ.data.docs.length} of {searchQ.data.total} matches. Refine the search to narrow them down.
      </RefFooterNote>,
    )
  }
  if (searching && notSynced.length > 0) {
    notes.push(
      <RefFooterNote key="sync" warn>
        Search can't see {notSynced.map((t) => t.value).join(', ')} (not synced to reporting); pick from the list instead.
      </RefFooterNote>,
    )
  }

  return (
    <RefCombobox
      id={id}
      items={shown.map(toItem)}
      selectedItem={selectedDoc ? toItem(selectedDoc) : undefined}
      unmatchedNote={valueQ.error instanceof WipNotFoundError ? 'not found' : valueQ.isError ? 'lookup failed' : ''}
      value={valueStr}
      onChange={onChange}
      disabled={disabled}
      isLoading={!searching && browseLoading}
      placeholder="Select a document..."
      emptyLabel="No documents match."
      search={search}
      onSearchChange={setSearch}
      searching={searchSettling}
      listMessage={
        listError ? (
          <p role="alert" className="text-xs text-danger text-center py-3 px-2">
            {searching ? 'Search' : 'Loading documents'} failed: {listError.message}
          </p>
        ) : undefined
      }
      footer={notes.length > 0 ? notes : undefined}
    />
  )
}
