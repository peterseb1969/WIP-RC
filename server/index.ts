import 'dotenv/config'
import express, { Router } from 'express'
import cors from 'cors'
import session from 'express-session'
import path from 'path'
import { fileURLToPath } from 'url'
import { wipProxy } from '@wip/proxy'
import { initAuth, requireAuth, handleCallback, handleLogout } from './auth.js'
import mongoRouter from './infra/mongo.js'
import natsRouter from './infra/nats.js'
import nlRouter from './nl/query.js'

const PORT = parseInt(process.env.PORT || '3010')

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

const app = express()
const router = Router()

app.use(cors())

// Session (required for OIDC auth)
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  name: 'rc.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    path: BASE_PATH,
  },
}))

// Parse JSON only for our own routes — NOT for /wip, which @wip/proxy
// needs to forward as a raw stream. express.json() consumes the body
// stream, causing "stream is not readable" in the proxy's body-parser.
router.use((req, res, next) => {
  if (req.path.startsWith('/wip')) return next()
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
  apiKey: process.env.WIP_API_KEY || '',
}))

// WIP service health checks — probes each service via Caddy
const WIP_SERVICES = [
  { name: 'Registry', slug: 'registry', path: '/api/registry/namespaces' },
  { name: 'Def-Store', slug: 'def-store', path: '/api/def-store/terminologies?page_size=1' },
  { name: 'Template-Store', slug: 'template-store', path: '/api/template-store/templates?page_size=1' },
  { name: 'Document-Store', slug: 'document-store', path: '/api/document-store/documents?page_size=1' },
  { name: 'Reporting-Sync', slug: 'reporting-sync', path: '/api/reporting-sync/status' },
  { name: 'Ingest-Gateway', slug: 'ingest-gateway', path: '/api/ingest-gateway/health' },
]

router.get('/api/infra/health', async (_req, res) => {
  const wipBase = process.env.WIP_BASE_URL || 'https://localhost:8443'
  const apiKey = process.env.WIP_API_KEY || ''

  const results = await Promise.allSettled(
    WIP_SERVICES.map(async (svc) => {
      const start = performance.now()
      try {
        const resp = await fetch(`${wipBase}${svc.path}`, {
          headers: { 'X-API-Key': apiKey },
          signal: AbortSignal.timeout(5000),
        })
        const ms = Math.round(performance.now() - start)
        return {
          name: svc.name,
          slug: svc.slug,
          status: resp.ok ? 'healthy' : 'unhealthy',
          responseTimeMs: ms,
          ...(resp.ok ? {} : { error: `HTTP ${resp.status}` }),
        }
      } catch (err: unknown) {
        const ms = Math.round(performance.now() - start)
        return {
          name: svc.name,
          slug: svc.slug,
          status: 'unhealthy',
          responseTimeMs: ms,
          error: err instanceof Error ? err.message : 'Connection failed',
        }
      }
    })
  )

  const services = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: WIP_SERVICES[i]!.name, slug: WIP_SERVICES[i]!.slug, status: 'unknown', responseTimeMs: null, error: 'Check failed' }
  )

  res.json({ services })
})

// Infrastructure routes
router.use('/api/infra/mongo', mongoRouter)
router.use('/api/infra/nats', natsRouter)

// NL Query — Claude API with WIP tool calls
router.use('/api/nl', nlRouter)

// User info
router.get('/api/me', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user)
  } else {
    res.json({ anonymous: true })
  }
})

// In production, serve the built frontend from dist/
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distPath = path.resolve(__dirname, '..', 'dist')
  router.use(express.static(distPath))
  // SPA fallback — serve index.html for all unmatched routes
  router.get('/{0,}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
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
