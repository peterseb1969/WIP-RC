import { useQuery } from '@tanstack/react-query'
import { apiUrl } from '@/lib/wip'

export interface ServiceHealth {
  name: string
  slug: string
  status: 'healthy' | 'unhealthy' | 'inactive' | 'unknown'
  responseTimeMs: number | null
  error?: string
}

async function fetchAllHealth(): Promise<ServiceHealth[]> {
  const res = await fetch(apiUrl('/api/infra/health'), { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`)
  const data = await res.json() as { services: ServiceHealth[] }
  return data.services
}

export function useServiceHealth() {
  return useQuery({
    queryKey: ['rc-console', 'service-health'],
    queryFn: fetchAllHealth,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/**
 * Check if a specific WIP service is inactive (not deployed).
 * Returns undefined while loading, true/false once resolved.
 */
export function useIsServiceInactive(slug: string): boolean | undefined {
  const { data, isLoading } = useServiceHealth()
  if (isLoading || !data) return undefined
  const svc = data.find(s => s.slug === slug)
  return svc?.status === 'inactive'
}
