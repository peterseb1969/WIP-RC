import { Router, type Response } from 'express'
import { connect, type NatsConnection } from 'nats'
import { natsAuthFromEnv, natsInboxPrefix, classifyNatsError, type NatsAuthMode } from './nats-auth.js'

const router = Router()

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222'
// A deployed console gets NATS_URL only when its manifest grants it NATS
// access; without it the localhost default is a host-mode guess.
const NATS_URL_CONFIGURED = !!process.env.NATS_URL

let nc: NatsConnection | null = null
// One connect attempt shared by concurrent requests, so a burst of page loads
// opens one connection instead of one each.
let connecting: Promise<NatsConnection> | null = null

/**
 * The cached connection, or a new one. Credentials are re-resolved for every
 * new connection; a connection NATS closes after repeated auth failures (for
 * example after a credential rotation) is replaced on the next request.
 */
async function getConnection(): Promise<NatsConnection> {
  if (nc && !nc.isClosed()) return nc
  if (connecting) return connecting
  const auth = natsAuthFromEnv()
  if (auth.configError) throw new Error(auth.configError)
  connecting = connect({
    servers: NATS_URL,
    timeout: 5000,
    name: 'rc-console',
    inboxPrefix: natsInboxPrefix(),
    ...(auth.authenticator ? { authenticator: auth.authenticator } : {}),
  })
  try {
    nc = await connecting
    return nc
  } finally {
    connecting = null
  }
}

/** 502 with the error message plus, for auth refusals, which kind. Never includes a secret. */
function sendNatsError(res: Response, err: unknown, fallback: string, extra: Record<string, unknown> = {}) {
  const mode: NatsAuthMode = natsAuthFromEnv().mode
  const message = err instanceof Error ? err.message : fallback
  res.status(502).json({
    ...extra,
    error: message,
    auth: mode,
    auth_error: classifyNatsError(err, mode) ?? null,
    url_configured: NATS_URL_CONFIGURED,
  })
}

/**
 * Drain all items from a nats Lister (which returns batches via .next()).
 */
async function drainLister<T>(lister: { next(): Promise<T[]> }): Promise<T[]> {
  const all: T[] = []
  let batch = await lister.next()
  while (batch.length > 0) {
    all.push(...batch)
    batch = await lister.next()
  }
  return all
}

// GET /api/infra/nats/status — connection status
router.get('/status', async (_req, res) => {
  try {
    const conn = await getConnection()
    const info = conn.info
    const auth = natsAuthFromEnv()
    res.json({
      connected: !conn.isClosed(),
      auth: auth.mode,
      user: auth.user ?? null,
      server: info?.server_name ?? null,
      version: info?.version ?? null,
      proto: info?.proto ?? null,
      jetstream: info?.jetstream ?? false,
    })
  } catch (err: unknown) {
    sendNatsError(res, err, 'Connection failed', { connected: false })
  }
})

// GET /api/infra/nats/streams — list all JetStream streams
router.get('/streams', async (_req, res) => {
  try {
    const conn = await getConnection()
    const jsm = await conn.jetstreamManager()
    const items = await drainLister(jsm.streams.list())

    const streams = items.map((si: any) => ({
      name: si.config.name,
      subjects: si.config.subjects ?? [],
      messages: si.state.messages,
      bytes: si.state.bytes,
      consumers: si.state.consumer_count,
      created: si.created ?? '',
      config: {
        retention: si.config.retention,
        storage: si.config.storage,
        max_msgs: si.config.max_msgs,
        max_bytes: si.config.max_bytes,
        max_age: si.config.max_age,
        num_replicas: si.config.num_replicas,
        discard: si.config.discard,
      },
    }))

    res.json({ streams })
  } catch (err: unknown) {
    sendNatsError(res, err, 'Failed to list streams')
  }
})

// GET /api/infra/nats/consumers/:stream — list consumers for a stream
router.get('/consumers/:stream', async (req, res) => {
  try {
    const conn = await getConnection()
    const jsm = await conn.jetstreamManager()
    const items = await drainLister(jsm.consumers.list(req.params.stream))

    const consumers = items.map((ci: any) => ({
      name: ci.config.durable_name ?? ci.name,
      stream: req.params.stream,
      ackPending: ci.num_ack_pending,
      numPending: ci.num_pending,
      delivered: ci.delivered?.stream_seq ?? 0,
      deliverPolicy: ci.config.deliver_policy ?? 'all',
      ackPolicy: ci.config.ack_policy ?? 'explicit',
      replayPolicy: ci.config.replay_policy ?? 'instant',
      created: ci.created ?? '',
    }))

    res.json({ stream: req.params.stream, consumers })
  } catch (err: unknown) {
    sendNatsError(res, err, 'Failed to list consumers')
  }
})

export default router
