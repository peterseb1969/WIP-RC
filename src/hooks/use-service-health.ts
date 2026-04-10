import { useQuery } from '@tanstack/react-query'
import { apiUrl } from '@/lib/wip'

export interface ServiceHealth {
  name: string
  slug: string
  status: 'healthy' | 'unhealthy' | 'unknown'
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
