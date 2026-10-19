/** The template slots that decide how a document is named in compact views. */
export interface LabelTemplate {
  header_fields?: string[]
  identity_fields?: string[]
}

/** Data keys tried when a template declares neither header nor identity fields. */
const FALLBACK_KEYS = ['name', 'label', 'title', 'display_name', 'value']

/**
 * A one-line name for a document, chosen the way the platform's header
 * projection chooses one: the first non-empty `header_fields` value; when the
 * template declares no header fields, its identity field values joined; then
 * a common naming key in `data`; then the start of the document id.
 * `metadata.custom.<name>` header paths read the document's metadata.
 */
export function documentLabel(
  doc: { document_id: string; data?: Record<string, unknown>; metadata?: { custom?: Record<string, unknown> } | null },
  template?: LabelTemplate,
): string {
  const data = doc.data ?? {}
  const header = template?.header_fields ?? []
  if (header.length > 0) {
    for (const path of header) {
      const v = display(project(path, data, doc.metadata?.custom))
      if (v) return v
    }
  } else {
    const identity = (template?.identity_fields ?? []).map(f => display(project(f, data))).filter(Boolean)
    if (identity.length > 0) return identity.join(' · ')
  }
  for (const key of FALLBACK_KEYS) {
    const v = display(data[key])
    if (v) return v
  }
  return doc.document_id.slice(0, 8)
}

function project(path: string, data: Record<string, unknown>, custom?: Record<string, unknown>): unknown {
  if (path.startsWith('metadata.custom.')) return custom?.[path.slice('metadata.custom.'.length)]
  let cur: unknown = data
  for (const part of (path.startsWith('data.') ? path.slice(5) : path).split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function display(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}
