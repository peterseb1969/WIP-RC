import { useQuery } from '@tanstack/react-query'

export interface ServiceHealth {
  name: string
  slug: string
  port: number
  status: 'healthy' | 'unhealthy' | 'unknown'
  responseTimeMs: number | null
  error?: string
}

const SERVICES = [
  { name: 'Registry', slug: 'registry', port: 8001 },
  { name: 'Def-Store', slug: 'def-store', port: 8002 },
  { name: 'Template-Store', slug: 'template-store', port: 8003 },
  { name: 'Document-Store', slug: 'document-store', port: 8004 },
  { name: 'Reporting-Sync', slug: 'reporting-sync', port: 8005 },
  { name: 'Ingest-Gateway', slug: 'ingest-gateway', port: 8006 },
]

async function checkServiceHealth(slug: string): Promise<{ ok: boolean; ms: number; error?: string }> {
  const start = performance.now()
  try {
    const res = await fetch(`/wip/api/${slug}/health`, { signal: AbortSignal.timeout(5000) })
    const ms = Math.round(performance.now() - start)
    if (res.ok) return { ok: true, ms }
    return { ok: false, ms, error: `HTTP ${res.status}` }
  } catch (err: unknown) {
    const ms = Math.round(performance.now() - start)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, ms, error: message }
  }
}

async function fetchAllHealth(): Promise<ServiceHealth[]> {
  const results = await Promise.allSettled(
    SERVICES.map(async (svc) => {
      const result = await checkServiceHealth(svc.slug)
      return {
        name: svc.name,
        slug: svc.slug,
        port: svc.port,
        status: result.ok ? 'healthy' : 'unhealthy',
        responseTimeMs: result.ms,
        error: result.error,
      } satisfies ServiceHealth
    })
  )

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          name: SERVICES[i]!.name,
          slug: SERVICES[i]!.slug,
          port: SERVICES[i]!.port,
          status: 'unknown' as const,
          responseTimeMs: null,
          error: 'Failed to check',
        }
  )
}

export function useServiceHealth() {
  return useQuery({
    queryKey: ['rc-console', 'service-health'],
    queryFn: fetchAllHealth,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
