import { useQuery } from '@tanstack/react-query'
import { useWipClient } from '@wip/react'
import type { Template } from '@wip/client'

export interface TemplateVersionOption {
  version: number
  status: Template['status']
  label: string
}

/**
 * List all versions of a template lineage by its template_id, newest first.
 *
 * Backs the version pickers for pinned schema references (CASE-493): a
 * `template_ref` / `array_template_ref` / `extends` must carry an explicit
 * pinned version — "latest" was deleted on the template→template axes — so
 * the builder needs the concrete version list to choose from.
 */
export function useTemplateVersions(templateId: string | undefined) {
  const client = useWipClient()

  return useQuery({
    queryKey: ['rc-console', 'template-versions', templateId],
    queryFn: async (): Promise<TemplateVersionOption[]> => {
      if (!templateId) return []
      const res = await client.templates.getTemplateVersionsById(templateId)
      return (res.items ?? [])
        .map((t: Template): TemplateVersionOption => ({
          version: t.version,
          status: t.status,
          label: t.label,
        }))
        .sort((a, b) => b.version - a.version)
    },
    enabled: !!templateId,
    staleTime: 60_000,
  })
}
