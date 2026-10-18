/**
 * Tests for requireAuth in gateway mode (no OIDC issuer): ALLOWED_GROUPS is
 * applied to the X-WIP-Groups identity header, a request with no identity is
 * refused when ALLOWED_GROUPS is set, and public paths always pass
 * (server/auth.ts).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'net'

async function serve(env: Record<string, string>) {
  vi.resetModules()
  vi.stubEnv('OIDC_ISSUER', '')
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  const { requireAuth } = await import('../../server/auth')
  const app = express()
  app.use(requireAuth())
  app.get('/health', (_req, res) => { res.json({ ok: true }) })
  app.get('/api/thing', (_req, res) => { res.json({ ok: true }) })
  const server = app.listen(0)
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const get = async (path: string, headers: Record<string, string> = {}) => {
    const r = await fetch(base + path, { headers })
    return { status: r.status, body: await r.json() }
  }
  return { get, close: () => new Promise<void>(resolve => server.close(() => resolve())) }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requireAuth — gateway mode with ALLOWED_GROUPS', () => {
  it('admits a gateway user in an allowed group', async () => {
    const s = await serve({ ALLOWED_GROUPS: 'wip-admins' })
    const r = await s.get('/api/thing', { 'X-WIP-User': 'admin@wip.local', 'X-WIP-Groups': 'wip-admins' })
    await s.close()
    expect(r.status).toBe(200)
  })

  it('refuses a gateway user in no allowed group with 403', async () => {
    const s = await serve({ ALLOWED_GROUPS: 'wip-admins' })
    const r = await s.get('/api/thing', { 'X-WIP-User': 'viewer@wip.local', 'X-WIP-Groups': 'wip-viewers' })
    await s.close()
    expect(r.status).toBe(403)
    expect(r.body.message).toMatch(/wip-admins/)
  })

  it('matches any one of several groups and tolerates spacing', async () => {
    const s = await serve({ ALLOWED_GROUPS: 'wip-admins, rc-operators' })
    const r = await s.get('/api/thing', { 'X-WIP-User': 'op@wip.local', 'X-WIP-Groups': 'wip-editors, rc-operators' })
    await s.close()
    expect(r.status).toBe(200)
  })

  it('refuses a request with no identity with 401 instead of open dev mode', async () => {
    const s = await serve({ ALLOWED_GROUPS: 'wip-admins' })
    const r = await s.get('/api/thing')
    await s.close()
    expect(r.status).toBe(401)
  })

  it('keeps health probes public', async () => {
    const s = await serve({ ALLOWED_GROUPS: 'wip-admins' })
    const r = await s.get('/health')
    await s.close()
    expect(r.status).toBe(200)
  })
})

describe('requireAuth — gateway mode without ALLOWED_GROUPS', () => {
  it('admits any request, as before (dev mode, or an open console)', async () => {
    const s = await serve({ ALLOWED_GROUPS: '' })
    const anonymous = await s.get('/api/thing')
    const viewer = await s.get('/api/thing', { 'X-WIP-User': 'viewer@wip.local', 'X-WIP-Groups': 'wip-viewers' })
    await s.close()
    expect(anonymous.status).toBe(200)
    expect(viewer.status).toBe(200)
  })
})
