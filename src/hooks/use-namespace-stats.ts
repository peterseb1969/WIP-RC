import { useQuery } from '@tanstack/react-query'
import { useWipClient, useNamespaces } from '@wip/react'

export interface NamespaceWithStats {
  prefix: string
  description: string
  terminologies: number
  templates: number
  documents: number
}

/**
 * Every namespace with its terminology / template / document counts, from the
 * Registry's per-namespace stats (registry getNamespaceStats). A namespace whose
 * stats call fails is kept with zero counts rather than dropped, so the
 * Namespaces page still lists it.
 */
export function useNamespaceStats() {
  const client = useWipClient()
  const { data: namespaces, isLoading: nsLoading } = useNamespaces()

  return useQuery({
    queryKey: ['rc-console', 'namespace-stats', namespaces?.map(n => n.prefix)],
    queryFn: async (): Promise<NamespaceWithStats[]> => {
      if (!namespaces) return []

      const results = await Promise.allSettled(
        namespaces
          .map(async (ns) => {
            try {
              const stats = await client.registry.getNamespaceStats(ns.prefix)
              return {
                prefix: ns.prefix,
                description: ns.description,
                terminologies: stats.entity_counts.terminologies ?? 0,
                templates: stats.entity_counts.templates ?? 0,
                documents: stats.entity_counts.documents ?? 0,
              }
            } catch {
              return {
                prefix: ns.prefix,
                description: ns.description,
                terminologies: 0,
                templates: 0,
                documents: 0,
              }
            }
          })
      )

      return results
        .filter((r): r is PromiseFulfilledResult<NamespaceWithStats> => r.status === 'fulfilled')
        .map(r => r.value)
    },
    enabled: !nsLoading && !!namespaces && namespaces.length > 0,
    staleTime: 60_000,
  })
}
