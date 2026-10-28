import type { Template, TemplateFacet } from '@wip/client'

export interface TemplateOption {
  template_id: string
  /** The template value — what the sync call takes and what the rest of the UI shows. */
  value: string
  /** Text for the dropdown: label and value together. */
  text: string
}

/**
 * Dropdown text carrying both names: "Label (VALUE)". The value alone when the
 * template has no label or the label is the value, so nothing is shown twice.
 */
export function templateOptionText(label: string | null | undefined, value: string): string {
  const l = label?.trim()
  return l && l !== value ? `${l} (${value})` : value
}

/**
 * Templates offered for a single-template batch sync.
 *
 * With no facets (no namespace scope) every template is offered. With a
 * namespace scope, only templates that the namespace's documents are instances
 * of are offered — membership by template_id, never by the template's own
 * namespace, because a document can be based on a template owned elsewhere and
 * a scoped sync of that template is exactly what the operator may want.
 *
 * Each template value is offered once. Templates of the same value in several
 * namespaces would show as identical lines, and a sync names the template by
 * value only, so every one of them would send the same request.
 *
 * Sorted by the text the dropdown shows (case-insensitive, numbers in natural
 * order), not by the value, which sits in parentheses after the label.
 */
export function syncTemplateOptions(
  templates: readonly Template[],
  facets: readonly TemplateFacet[] | null,
): TemplateOption[] {
  const inScope = facets ? new Set(facets.map(f => f.template_id)) : null
  const byValue = new Map<string, TemplateOption>()
  for (const t of templates) {
    if (inScope && !inScope.has(t.template_id)) continue
    if (byValue.has(t.value)) continue
    byValue.set(t.value, {
      template_id: t.template_id,
      value: t.value,
      text: templateOptionText(t.label, t.value),
    })
  }
  return [...byValue.values()].sort(
    (a, b) => collator.compare(a.text, b.text) || a.value.localeCompare(b.value),
  )
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
