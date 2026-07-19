import 'dotenv/config'
import express, { Router } from 'express'
import cors from 'cors'
import session from 'express-session'
import path from 'path'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { wipProxy } from '@wip/proxy'
import { initAuth, requireAuth, handleCallback, handleLogout } from './auth.js'
import mongoRouter from './infra/mongo.js'
import natsRouter from './infra/nats.js'
import nlRouter from './nl/query.js'

const PORT = parseInt(process.env.PORT || '3011')

/**
 * APP_BASE_PATH — the external path prefix when behind a reverse proxy.
 * E.g. /apps/rc when Caddy routes https://host:8443/apps/rc/* to this app.
 *
 * With Option 2 (CASE-38), Caddy does NOT strip the prefix. The app
 * receives the full path and mounts all routes under APP_BASE_PATH.
 * This means the app is fully aware of where it lives — cookies,
 * OIDC redirects, and internal routing all use the same prefix.
 *
 * When unset (local dev), defaults to '/' — no prefix.
 */
const BASE_PATH = (process.env.APP_BASE_PATH || '').replace(/\/$/, '') || '/'

// WIP_API_KEY_FILE is the live wip-deploy secrets file (CASE-495); the literal
// WIP_API_KEY is the fallback — deployer-injected in containers, where the
// file path is host-only (CASE-714's failure shape). Mirrors wipProxy 0.4.3.
function resolveWipApiKey(): string {
  const file = process.env.WIP_API_KEY_FILE
  if (file) {
    try {
      const key = readFileSync(file, 'utf-8').trim()
      if (key) return key
    } catch { /* fall back to the inline key */ }
  }
  return process.env.WIP_API_KEY || ''
}

const app = express()
const router = Router()

// Trust reverse proxy (Caddy) — required for secure cookies and
// correct req.protocol when behind HTTPS termination
app.set('trust proxy', 1)

app.use(cors())

// Session (required for OIDC auth)
// Must be on `app` (not `router`) so it runs for all paths including
// the callback route before the router mounts.
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  name: 'rc.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    path: BASE_PATH.endsWith('/') ? BASE_PATH : `${BASE_PATH}/`,
  },
}))

// Parse JSON only for our own routes — NOT for /wip, which @wip/proxy
// needs to forward as a raw stream. express.json() consumes the body
// stream, causing "stream is not readable" in the proxy's body-parser.
router.use((req, res, next) => {
  if (req.path.startsWith('/wip') || req.path.startsWith('/api/backup-restore')) return next()
  express.json()(req, res, next)
})

// Auth routes
router.get('/auth/callback', (req, res) => { handleCallback(req, res) })
router.get('/auth/logout', handleLogout)
router.use(requireAuth())

// Health
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rc-console' })
})

// WIP API proxy — frontend uses @wip/client with baseUrl: '/wip'
router.use('/wip', wipProxy({
  baseUrl: process.env.WIP_BASE_URL || 'https://localhost:8443',
  // WIP_API_KEY_FILE is the live wip-deploy secrets file (CASE-495); a
  // literal WIP_API_KEY is the legacy/local fallback. apiKeyFile wins.
  apiKeyFile: process.env.WIP_API_KEY_FILE,
  apiKey: process.env.WIP_API_KEY || '',
}))

// WIP service health checks — probes each service via Caddy
// `buildPath` is a service's root endpoint that returns a CASE-526 `build`
// block ({version, sha, built_at, image_tag}). Only the wip-auth services
// expose it today; the gateways / mcp-server carry OCI image labels but no
// endpoint yet, so they omit it.
const WIP_SERVICES = [
  { name: 'Registry', slug: 'registry', path: '/api/registry/namespaces', buildPath: '/api/registry/' },
  { name: 'Def-Store', slug: 'def-store', path: '/api/def-store/terminologies?page_size=1', buildPath: '/api/def-store/' },
  { name: 'Template-Store', slug: 'template-store', path: '/api/template-store/templates?page_size=1', buildPath: '/api/template-store/' },
  { name: 'Document-Store', slug: 'document-store', path: '/api/document-store/documents?page_size=1', buildPath: '/api/document-store/' },
  { name: 'Reporting-Sync', slug: 'reporting-sync', path: '/api/reporting-sync/status', buildPath: '/api/reporting-sync/' },
  { name: 'Ingest-Gateway', slug: 'ingest-gateway', path: '/api/ingest-gateway/health' },
  { name: 'File-Store', slug: 'file-store', path: '/api/document-store/files?page_size=1' },
]

interface BuildInfo { version?: string; sha?: string; built_at?: string; image_tag?: string }

// Best-effort fetch of a service's CASE-526 build block from its root endpoint.
// Returns undefined if the service is old (no build block) or unreachable.
async function probeBuild(wipBase: string, apiKey: string, buildPath: string): Promise<BuildInfo | undefined> {
  try {
    const resp = await fetch(`${wipBase}${buildPath}`, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok || !(resp.headers.get('content-type') ?? '').includes('application/json')) return undefined
    const body = await resp.json() as { build?: BuildInfo }
    return body.build && typeof body.build === 'object' ? body.build : undefined
  } catch {
    return undefined
  }
}

router.get('/api/infra/health', async (_req, res) => {
  const wipBase = process.env.WIP_BASE_URL || 'https://localhost:8443'
  const apiKey = resolveWipApiKey()

  const results = await Promise.allSettled(
    WIP_SERVICES.map(async (svc) => {
      const start = performance.now()
      // Fetch build provenance (CASE-526) in parallel with the health probe.
      const buildPromise = svc.buildPath ? probeBuild(wipBase, apiKey, svc.buildPath) : Promise.resolve(undefined)
      try {
        const resp = await fetch(`${wipBase}${svc.path}`, {
          headers: { 'X-API-Key': apiKey },
          signal: AbortSignal.timeout(5000),
        })
        const ms = Math.round(performance.now() - start)
        const contentType = resp.headers.get('content-type') ?? ''
        const isJson = contentType.includes('application/json')
        const build = await buildPromise
        const base = { name: svc.name, slug: svc.slug, responseTimeMs: ms, probedPath: svc.path, httpStatus: resp.status, contentType, build }

        // 404 / non-JSON response usually means the service isn't deployed
        // (Caddy returns a fallback HTML page or 404 for unrouted paths).
        if (resp.status === 404 || (!isJson && resp.status >= 400)) {
          return { ...base, status: 'inactive', error: `Not deployed (HTTP ${resp.status}, ${contentType || 'no content-type'})` }
        }
        if (!resp.ok) {
          return { ...base, status: 'unhealthy', error: `HTTP ${resp.status}` }
        }
        // 2xx but not JSON → Caddy fallback page or similar
        if (!isJson) {
          return { ...base, status: 'inactive', error: `Not deployed (HTTP ${resp.status} but ${contentType || 'no content-type'} — likely router fallback)` }
        }
        return { ...base, status: 'healthy' }
      } catch (err: unknown) {
        const ms = Math.round(performance.now() - start)
        const msg = err instanceof Error ? err.message : 'Connection failed'
        // ECONNREFUSED / getaddrinfo failures → treat as inactive
        const isInactive = /ECONNREFUSED|ENOTFOUND|getaddrinfo|fetch failed/i.test(msg)
        return {
          name: svc.name,
          slug: svc.slug,
          status: isInactive ? 'inactive' : 'unhealthy',
          responseTimeMs: ms,
          probedPath: svc.path,
          error: msg,
          build: await buildPromise,
        }
      }
    })
  )

  const services = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: WIP_SERVICES[i]!.name, slug: WIP_SERVICES[i]!.slug, status: 'unknown', responseTimeMs: null, probedPath: WIP_SERVICES[i]!.path, error: 'Check failed' }
  )

  res.json({ services })
})

// Streaming proxy for file content.
// WIP's getDownloadUrl returns a presigned MinIO URL with hostname 'localhost:9000'
// which is unreachable from the browser outside the cluster. This endpoint
// fetches the file content via WIP's /content endpoint (which streams from
// MinIO internally) and pipes it to the browser.
router.get('/api/file-content/:fileId', async (req, res) => {
  const wipBase = process.env.WIP_BASE_URL || 'https://localhost:8443'
  const apiKey = resolveWipApiKey()
  try {
    const upstream = await fetch(
      `${wipBase}/api/document-store/files/${req.params.fileId}/content`,
      { headers: { 'X-API-Key': apiKey } },
    )
    if (!upstream.ok) {
      res.status(upstream.status).send(await upstream.text())
      return
    }
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    const contentLength = upstream.headers.get('content-length')
    if (contentLength) res.setHeader('Content-Length', contentLength)
    // If query param ?download=1, set attachment header; otherwise inline for preview
    if (req.query.download === '1') {
      const filename = req.query.filename ?? req.params.fileId
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    } else {
      res.setHeader('Content-Disposition', 'inline')
    }
    const reader = upstream.body?.getReader()
    if (!reader) { res.status(502).send('No response body'); return }
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read()
      if (done) { res.end(); return }
      if (!res.write(value)) {
        await new Promise<void>(resolve => res.once('drain', resolve))
      }
      return pump()
    }
    await pump()
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'File proxy failed' })
    }
  }
})

// Streaming download proxy for large backup archives.
// The standard @wip/proxy buffers responses which fails for multi-GB files.
// This route pipes the response directly from WIP to the client.
router.get('/api/backup-download/:jobId', async (req, res) => {
  const wipBase = process.env.WIP_BASE_URL || 'https://localhost:8443'
  const apiKey = resolveWipApiKey()
  try {
    const upstream = await fetch(
      `${wipBase}/api/document-store/backup/jobs/${req.params.jobId}/download`,
      { headers: { 'X-API-Key': apiKey } },
    )
    if (!upstream.ok) {
      res.status(upstream.status).send(await upstream.text())
      return
    }
    res.setHeader('Content-Type', 'application/zip')
    // Client passes a human-useful name (<namespace>_<timestamp>.zip). Sanitize
    // hard — it lands in a response header, so strip anything that could enable
    // header injection or path traversal. Fall back to the job id if absent.
    const rawName = typeof req.query.filename === 'string' ? req.query.filename : ''
    const safeName = rawName.replace(/[^A-Za-z0-9._-]/g, '')
    const filename = safeName && safeName.endsWith('.zip') ? safeName : `backup-${req.params.jobId}.zip`
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    if (upstream.headers.get('content-length')) {
      res.setHeader('Content-Length', upstream.headers.get('content-length')!)
    }
    // Pipe the readable stream directly to the response
    const reader = upstream.body?.getReader()
    if (!reader) { res.status(502).send('No response body'); return }
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read()
      if (done) { res.end(); return }
      if (!res.write(value)) {
        await new Promise<void>(resolve => res.once('drain', resolve))
      }
      return pump()
    }
    await pump()
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Download proxy failed' })
    }
  }
})

// Streaming restore proxy.
// The restore endpoint requires a namespace in the URL path for routing,
// but since CASE-43 the endpoint reads the actual target from the archive.
// We use '_' as a placeholder — it's only for auth.
router.post('/api/backup-restore', express.raw({ type: 'multipart/form-data', limit: '10gb' }), async (req, res) => {
  const wipBase = process.env.WIP_BASE_URL || 'https://localhost:8443'
  const apiKey = resolveWipApiKey()
  try {
    const contentType = req.headers['content-type'] || ''
    const upstream = await fetch(
      `${wipBase}/api/document-store/backup/namespaces/_/restore`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': contentType,
        },
        body: req.body as unknown as BodyInit,
      },
    )
    const data = await upstream.text()
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(data)
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Restore proxy failed' })
  }
})

// Infrastructure routes
router.use('/api/infra/mongo', mongoRouter)
router.use('/api/infra/nats', natsRouter)

// NL Query — Claude API with WIP tool calls
router.use('/api/nl', nlRouter)

// User info — reads identity from gateway headers (X-WIP-User) first,
// falls back to OIDC session, then anonymous.
router.get('/api/me', (req, res) => {
  // Gateway auth: identity injected by wip-auth-gateway via Caddy forward_auth
  const gwUser = req.headers['x-wip-user'] as string | undefined
  if (gwUser) {
    const groups = (req.headers['x-wip-groups'] as string || '').split(',').filter(Boolean)
    res.json({ email: gwUser, groups, method: 'gateway' })
    return
  }
  // OIDC session (standalone mode)
  if (req.session?.user) {
    res.json(req.session.user)
    return
  }
  res.json({ anonymous: true })
})

// In production, serve the built frontend from dist/
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distPath = path.resolve(__dirname, '..', 'dist')
  router.use(express.static(distPath))
  // SPA fallback — serve index.html for all unmatched routes
  // Explicit root handler + wildcard for deep routes
  const indexHtml = path.join(distPath, 'index.html')
  router.get('/', (_req, res) => { res.sendFile(indexHtml) })
  router.get('{*path}', (_req, res) => { res.sendFile(indexHtml) })
}

// Mount router at BASE_PATH
app.use(BASE_PATH, router)

async function main() {
  await initAuth()
  app.listen(PORT, () => {
    console.log(`rc-console backend listening on http://localhost:${PORT}`)
    if (BASE_PATH !== '/') {
      console.log(`  base path: ${BASE_PATH}`)
    }
  })
}

main().catch(err => {
  console.error('Failed to start:', err)
  process.exit(1)
})
