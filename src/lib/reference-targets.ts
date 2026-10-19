/** The fields of a template that identify it: canonical id, namespace and value. */
export interface TemplateIdentity {
  template_id: string
  namespace: string
  value: string
}

/** The fields of a terminology that identify it: canonical id, namespace and value. */
export interface TerminologyIdentity {
  terminology_id: string
  namespace: string
  value: string
}

/**
 * The template a reference field's `target_templates` entry names, resolved the
 * way the platform resolves it: a canonical id matches exactly; `ns:VALUE`
 * names its namespace; a bare value means the referring document's own
 * namespace and never another one that happens to use the same value. With no
 * namespace known, a bare value falls back to the first template carrying it.
 */
export function resolveTargetTemplate<T extends TemplateIdentity>(
  target: string,
  templates: T[],
  namespace?: string,
): T | undefined {
  return resolveByIdentity(target, templates, t => t.template_id, namespace)
}

/**
 * The terminology a term field's `terminology_ref` names, by the same rules as
 * {@link resolveTargetTemplate}: canonical id, `ns:VALUE`, or a bare value in
 * the document's own namespace.
 */
export function resolveTerminologyRef<T extends TerminologyIdentity>(
  ref: string,
  terminologies: T[],
  namespace?: string,
): T | undefined {
  return resolveByIdentity(ref, terminologies, t => t.terminology_id, namespace)
}

/**
 * The namespaces a document in `namespace` may reference documents in: its
 * own; `wip` when its isolation mode is open; and its `allowed_external_refs`.
 * The platform refuses a reference into any other namespace. Without the
 * namespace's config, only its own namespace is certain.
 */
export function referenceNamespaces(
  namespace: string,
  config?: { isolation_mode?: string; allowed_external_refs?: string[] } | null,
): string[] {
  const out = [namespace]
  if (config?.isolation_mode === 'open') out.push('wip')
  out.push(...(config?.allowed_external_refs ?? []))
  return [...new Set(out)]
}

function resolveByIdentity<T extends { namespace: string; value: string }>(
  ref: string,
  items: T[],
  idOf: (item: T) => string,
  namespace?: string,
): T | undefined {
  const byId = items.find(t => idOf(t) === ref)
  if (byId) return byId
  const colon = ref.indexOf(':')
  if (colon > 0) {
    const ns = ref.slice(0, colon)
    const value = ref.slice(colon + 1)
    return items.find(t => t.namespace === ns && t.value === value)
  }
  if (namespace) return items.find(t => t.namespace === namespace && t.value === ref)
  return items.find(t => t.value === ref)
}
