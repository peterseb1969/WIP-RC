import { useQuery } from '@tanstack/react-query'
import { apiUrl } from '@/lib/wip'

export interface NatsStatus {
  connected: boolean
  server?: string | null
  version?: string | null
  jetstream?: boolean
  error?: string
}

export interface NatsStream {
  name: string
  subjects: string[]
  messages: number
  bytes: number
  consumers: number
  created: string
  config: Record<string, unknown>
}

export interface NatsConsumer {
  name: string
  stream: string
  ackPending: number
  numPending: number
  delivered: number
  deliverPolicy: string
  ackPolicy: string
  replayPolicy: string
  created: string
}

async function fetchNats<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(`/api/infra/nats${path}`))
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NATS ${path}: HTTP ${res.status} — ${body}`)
  }
  return res.json()
}

export function useNatsStatus() {
  return useQuery({
    queryKey: ['rc-console', 'nats', 'status'],
    queryFn: () => fetchNats<NatsStatus>('/status'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useNatsStreams() {
  return useQuery({
    queryKey: ['rc-console', 'nats', 'streams'],
    queryFn: () => fetchNats<{ streams: NatsStream[] }>('/streams').then(r => r.streams),
    staleTime: 30_000,
  })
}

export interface IngestGatewayStatus {
  running: boolean
  nats_connected: boolean
  messages_processed: number
  messages_failed: number
  uptime_seconds: number
}

export function useIngestGatewayStatus() {
  return useQuery({
    queryKey: ['rc-console', 'ingest-gateway', 'status'],
    queryFn: async (): Promise<IngestGatewayStatus | null> => {
      try {
        const res = await fetch(apiUrl('/wip/api/ingest-gateway/status'))
        if (!res.ok) return null
        return res.json()
      } catch {
        return null
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useNatsConsumers(stream: string | null) {
  return useQuery({
    queryKey: ['rc-console', 'nats', 'consumers', stream],
    queryFn: () =>
      fetchNats<{ consumers: NatsConsumer[] }>(`/consumers/${stream}`).then(r => r.consumers),
    enabled: !!stream,
    staleTime: 30_000,
  })
}
