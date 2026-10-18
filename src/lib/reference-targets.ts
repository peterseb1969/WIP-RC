/** The fields of a template that identify it: canonical id, namespace and value. */
export interface TemplateIdentity {
  template_id: string
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
  const byId = templates.find(t => t.template_id === target)
  if (byId) return byId
  const colon = target.indexOf(':')
  if (colon > 0) {
    const ns = target.slice(0, colon)
    const value = target.slice(colon + 1)
    return templates.find(t => t.namespace === ns && t.value === value)
  }
  if (namespace) return templates.find(t => t.namespace === namespace && t.value === target)
  return templates.find(t => t.value === target)
}
