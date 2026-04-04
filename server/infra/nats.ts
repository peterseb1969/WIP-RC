import { Router } from 'express'
import { connect, type NatsConnection, type JetStreamManager, type StreamInfo, type ConsumerInfo } from 'nats'

const router = Router()

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222'

let nc: NatsConnection | null = null

async function getConnection(): Promise<NatsConnection> {
  if (!nc || nc.isClosed()) {
    nc = await connect({
      servers: NATS_URL,
      timeout: 5000,
      name: 'rc-console',
    })
  }
  return nc
}

// GET /api/infra/nats/status — connection status
router.get('/status', async (_req, res) => {
  try {
    const conn = await getConnection()
    const info = conn.info
    res.json({
      connected: !conn.isClosed(),
      server: info?.server_name ?? null,
      version: info?.version ?? null,
      proto: info?.proto ?? null,
      jetstream: info?.jetstream ?? false,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    res.status(502).json({ connected: false, error: message })
  }
})

// GET /api/infra/nats/streams — list all JetStream streams
router.get('/streams', async (_req, res) => {
  try {
    const conn = await getConnection()
    const jsm = await conn.jetstreamManager()

    const streams: Array<{
      name: string
      subjects: string[]
      messages: number
      bytes: number
      consumers: number
      created: string
      config: Record<string, unknown>
    }> = []

    for await (const si of jsm.streams()) {
      streams.push({
        name: si.config.name,
        subjects: si.config.subjects ?? [],
        messages: si.state.messages,
        bytes: si.state.bytes,
        consumers: si.state.consumer_count,
        created: si.created?.toISOString?.() ?? '',
        config: {
          retention: si.config.retention,
          storage: si.config.storage,
          max_msgs: si.config.max_msgs,
          max_bytes: si.config.max_bytes,
          max_age: si.config.max_age,
          num_replicas: si.config.num_replicas,
          discard: si.config.discard,
        },
      })
    }

    res.json({ streams })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list streams'
    res.status(502).json({ error: message })
  }
})

// GET /api/infra/nats/consumers/:stream — list consumers for a stream
router.get('/consumers/:stream', async (req, res) => {
  try {
    const conn = await getConnection()
    const jsm = await conn.jetstreamManager()

    const consumers: Array<{
      name: string
      stream: string
      ackPending: number
      numPending: number
      delivered: number
      deliverPolicy: string
      ackPolicy: string
      replayPolicy: string
      created: string
    }> = []

    for await (const ci of jsm.consumers.list(req.params.stream)) {
      consumers.push({
        name: ci.config.durable_name ?? ci.name,
        stream: req.params.stream,
        ackPending: ci.num_ack_pending,
        numPending: ci.num_pending,
        delivered: ci.delivered?.stream_seq ?? 0,
        deliverPolicy: ci.config.deliver_policy ?? 'all',
        ackPolicy: ci.config.ack_policy ?? 'explicit',
        replayPolicy: ci.config.replay_policy ?? 'instant',
        created: ci.created?.toISOString?.() ?? '',
      })
    }

    res.json({ stream: req.params.stream, consumers })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list consumers'
    res.status(502).json({ error: message })
  }
})

export default router
