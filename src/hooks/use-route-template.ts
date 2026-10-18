import { useQuery } from '@tanstack/react-query'
import { useTemplate, useWipClient } from '@wip/react'
import type { Template } from '@wip/client'

/**
 * The template behind a `/documents/:templateValue/...` route.
 *
 * A template value is unique only within its namespace — the same value can
 * exist in several namespaces — so the value alone is ambiguous. In-app links
 * carry `?template_id=`, which identifies exactly one template and wins. A bare
 * value (a typed or bookmarked URL) is resolved in the selected namespace only;
 * with no namespace selected it falls back to the platform's unscoped lookup.
 * Never resolve by value without a namespace when one is known: the unscoped
 * lookup returns whichever namespace's template comes first, and writes made
 * against it land in that namespace.
 */
export function useRouteTemplate(templateValue: string | undefined, opts: {
  templateId?: string | null
  namespace?: string
  enabled?: boolean
}) {
  const client = useWipClient()
  const enabled = opts.enabled ?? true
  const byId = useTemplate(opts.templateId ?? '', { enabled: enabled && !!opts.templateId })
  const ns = opts.namespace || undefined
  const byValue = useQuery<Template>({
    queryKey: ['wip', 'templates', 'by-value', templateValue, ns ?? null],
    queryFn: () => client.templates.getTemplateByValue(templateValue!, ns ? { namespace: ns } : undefined),
    enabled: enabled && !opts.templateId && !!templateValue,
    staleTime: 30_000,
    retry: false,
  })
  return opts.templateId ? byId : byValue
}

/** `?template_id=<id>` for links into a template's document routes. */
export function templateIdParam(templateId: string | null | undefined): string {
  return templateId ? `template_id=${encodeURIComponent(templateId)}` : ''
}
