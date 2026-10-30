// @vitest-environment node
// Server code: run under Node, not jsdom, whose Uint8Array lacks what the OIDC
// library's PKCE helpers expect.
/**
 * OIDC mode start-up (server/auth.ts): the server must come up while the
 * identity provider is still starting. Discovery runs in the background and is
 * retried; until it succeeds every non-public request gets 503, never the
 * gateway/dev rules (which would trust a caller-supplied X-WIP-User header),
 * and the health probes keep answering.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import session from 'express-session'
import type { AddressInfo } from 'net'

const AUTHZ = 'http://dex.test/dex/auth'

/** Loads server/auth with OIDC configured and discovery failing `failures` times first. */
async function load(env: Record<string, string>, failures: number) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  const discovery = vi.fn()
  for (let i = 0; i < failures; i++) discovery.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
  discovery.mockResolvedValue({ serverMetadata: () => ({ authorization_endpoint: AUTHZ }) })
  vi.doMock('openid-client', async (orig) => ({ ...(await orig<typeof import('openid-client')>()), discovery }))
  const auth = await import('../../server/auth')
  return { ...auth, discovery }
}

async function serve(auth: Awaited<ReturnType<typeof load>>) {
  const app = express()
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }))
  app.use(auth.requireAuth())
  app.get('/health', (_req, res) => { res.json({ ok: true }) })
  app.get('/api/thing', (_req, res) => { res.json({ ok: true }) })
  app.get('/auth/callback', (req, res) => { void auth.handleCallback(req, res) })
  const server = app.listen(0)
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const get = (path: string, headers: Record<string, string> = {}) => fetch(base + path, { headers, redirect: 'manual' })
  return { get, close: () => new Promise<void>(resolve => server.close(() => resolve())) }
}

const OIDC_ENV = { OIDC_ISSUER: 'http://dex.test/dex', ALLOWED_GROUPS: 'wip-admins' }

afterEach(() => {
  vi.unstubAllEnvs()
  vi.doUnmock('openid-client')
  vi.restoreAllMocks()
})

describe('OIDC start-up while the identity provider is down', () => {
  it('answers 503 for app routes, even with forged gateway headers, and keeps health up', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // One failure, then a long wait: discovery stays pending for this test, and
    // the background loop does not run on into the next one.
    const auth = await load(OIDC_ENV, 1)
    void auth.startAuth({ initialDelayMs: 10_000, maxDelayMs: 10_000 })
    const s = await serve(auth)

    expect(auth.authStatus()).toBe('pending')
    const forged = await s.get('/api/thing', { 'X-WIP-User': 'x@evil', 'X-WIP-Groups': 'wip-admins' })
    expect(forged.status).toBe(503)
    expect(forged.headers.get('retry-after')).toBe('5')
    expect((await s.get('/auth/callback?code=c&state=s')).status).toBe(503)
    expect((await s.get('/health')).status).toBe(200)
    await s.close()
  })

  it('keeps retrying, logs each failure, and turns sign-in on once discovery succeeds', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const auth = await load(OIDC_ENV, 3)
    await auth.startAuth({ initialDelayMs: 5, maxDelayMs: 20 })

    expect(auth.discovery).toHaveBeenCalledTimes(4)
    expect(warn).toHaveBeenCalledTimes(3)
    expect(warn.mock.calls[0][0]).toMatch(/attempt 1 failed \(connect ECONNREFUSED\)/)
    expect(auth.authStatus()).toBe('ready')

    const s = await serve(auth)
    const r = await s.get('/api/thing')
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toMatch(new RegExp(`^${AUTHZ}\\?`))
    await s.close()
  })
})

describe('gateway mode', () => {
  it('starts at once with sign-in off and never calls discovery', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const auth = await load({ OIDC_ISSUER: '' }, 0)
    await auth.startAuth()
    expect(auth.authStatus()).toBe('off')
    expect(auth.discovery).not.toHaveBeenCalled()
  })
})
