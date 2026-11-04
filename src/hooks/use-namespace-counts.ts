import { useQuery } from '@tanstack/react-query'
import { useWipClient } from '@wip/react'
import { templateCounts, termCounts, type NamespaceCounts } from '@/lib/namespace-counts'

/**
 * Query-key root of one namespace's details on the Namespaces page. The
 * page's Refresh invalidates everything under it.
 */
export const NS_DETAIL_KEY = (prefix: string) => ['rc-console', 'ns-detail', prefix] as const

const PAGE = 1000

/** Every item of a paged listing. */
async function allPages<T>(fetch: (page: number) => Promise<{ items: T[]; total?: number; pages?: number }>): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const res = await fetch(page)
    items.push(...res.items)
    const pages = res.pages ?? Math.ceil((res.total ?? items.length) / PAGE)
    if (page >= pages || res.items.length === 0) return items
  }
}

/**
 * What a namespace holds now, live and retired per kind, read from the
 * services that own the data (see namespace-counts.ts for why not the
 * Registry). Deprecated terms are not here: they are derived from the
 * Registry's term count (termCounts), which the caller already reads.
 */
export function useNamespaceCounts(prefix: string | null) {
  const client = useWipClient()
  return useQuery({
    queryKey: [...NS_DETAIL_KEY(prefix ?? ''), 'counts'],
    enabled: !!prefix,
    staleTime: 60_000,
    queryFn: async (): Promise<Omit<NamespaceCounts, 'terms'> & { activeTerms: number }> => {
      const ns = prefix!
      const docTotal = (status: 'active' | 'inactive') =>
        client.documents.listDocuments({ namespace: ns, latest_only: true, status, page_size: 1 }).then(r => r.total)
      const fileTotal = (status: 'active' | 'orphan' | 'inactive') =>
        client.files.listFiles({ namespace: ns, status, page_size: 1 }).then(r => r.total)
      const terminologies = (status: 'active' | 'inactive') =>
        allPages(page => client.defStore.listTerminologies({ namespace: ns, status, page, page_size: PAGE }))

      const [docsActive, docsDeleted, templateRows, termsActive, termsInactive, filesActive, filesOrphan, filesDeleted] =
        await Promise.all([
          docTotal('active'),
          docTotal('inactive'),
          allPages(page => client.templates.listTemplates({ namespace: ns, page, page_size: PAGE })),
          terminologies('active'),
          terminologies('inactive'),
          fileTotal('active'),
          fileTotal('orphan'),
          fileTotal('inactive'),
        ])

      return {
        terminologies: { active: termsActive.length, retired: termsInactive.length },
        activeTerms: termCounts([...termsActive, ...termsInactive].map(t => t.term_count), undefined).active,
        templates: templateCounts(templateRows),
        documents: { active: docsActive, retired: docsDeleted },
        files: { active: filesActive + filesOrphan, orphan: filesOrphan, retired: filesDeleted },
      }
    },
  })
}
