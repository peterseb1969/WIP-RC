import { useQuery } from '@tanstack/react-query'
import { apiUrl } from '@/lib/wip'

export interface NatsStatus {
  connected: boolean
  server?: string | null
  version?: string | null
  jetstream?: boolean
  error?: string
  /** How the backend authenticates: anonymous, user/password, or a creds file. */
  auth?: 'none' | 'user' | 'creds'
  /** NATS username when `auth` is `user` (not secret). */
  user?: string | null
  /** Set when NATS refused the connection for authentication reasons. */
  auth_error?: 'not_configured' | 'rejected' | null
  /** False when the server has no NATS_URL and fell back to localhost. */
  url_configured?: boolean
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

async function fetchNatsStatus(): Promise<NatsStatus> {
  try {
    const res = await fetch(apiUrl('/api/infra/nats/status'))
    const body = await res.json()
    if (!res.ok) return { ...body, connected: false, error: body.error ?? `HTTP ${res.status}` }
    return body
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : 'Unreachable' }
  }
}

/**
 * NATS connection status from the backend's direct NATS client
 * (`/api/infra/nats/status`). Never throws: an unreachable backend or NATS
 * resolves to `{ connected: false, error }` so the page can render the state.
 */
export function useNatsStatus() {
  return useQuery({
    queryKey: ['rc-console', 'nats', 'status'],
    queryFn: fetchNatsStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** JetStream streams with message/byte/consumer counts (`/api/infra/nats/streams`). */
export function useNatsStreams(enabled = true) {
  return useQuery({
    queryKey: ['rc-console', 'nats', 'streams'],
    queryFn: () => fetchNats<{ streams: NatsStream[] }>('/streams').then(r => r.streams),
    staleTime: 30_000,
    enabled,
  })
}

export interface IngestGatewayStatus {
  running: boolean
  nats_connected: boolean
  messages_processed: number
  messages_failed: number
  uptime_seconds: number
}

/**
 * Ingest-Gateway runtime status via the WIP proxy (`/wip/api/ingest-gateway/status`).
 * Resolves to `null` when the gateway is not deployed or unreachable — it is an
 * optional module, so absence is a state, not an error.
 */
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

/**
 * Consumers of one JetStream stream (`/api/infra/nats/consumers/:stream`), with
 * pending/ack counts. Idle until a stream is selected.
 */
export function useNatsConsumers(stream: string | null) {
  return useQuery({
    queryKey: ['rc-console', 'nats', 'consumers', stream],
    queryFn: () =>
      fetchNats<{ consumers: NatsConsumer[] }>(`/consumers/${stream}`).then(r => r.consumers),
    enabled: !!stream,
    staleTime: 30_000,
  })
}
