/**
 * Tests for the maintenance gate (server/maintenance-gate.ts): the document-store
 * maintenance endpoints need an admin group, every other proxied path does not,
 * and odd spellings of the maintenance path cannot slip past the prefix match.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import http from 'http'
import type { AddressInfo } from 'net'

const MAINTENANCE = '/wip/api/document-store/maintenance/rehash-identities'

async function serve(env: Record<string, string> = {}) {
  vi.resetModules()
  vi.stubEnv('OIDC_ISSUER', '')
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  const { guardMaintenance } = await import('../../server/maintenance-gate')
  const app = express()
  app.use(guardMaintenance())
  app.use((_req, res) => { res.json({ reached: true }) })
  const server = app.listen(0)
  const port = (server.address() as AddressInfo).port
  // http.request, not fetch: fetch normalizes `/./` and `%2e` before sending,
  // and the point here is the path as the server receives it.
  const get = (reqPath: string, headers: Record<string, string> = {}) =>
    new Promise<number>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: reqPath, headers }, res => {
        res.resume()
        resolve(res.statusCode ?? 0)
      })
      req.on('error', reject)
      req.end()
    })
  return { get, close: () => new Promise<void>(resolve => server.close(() => resolve())) }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

const admin = { 'X-WIP-User': 'admin@wip.local', 'X-WIP-Groups': 'wip-admins' }
const editor = { 'X-WIP-User': 'editor@wip.local', 'X-WIP-Groups': 'wip-editors' }

describe('isMaintenancePath', () => {
  it('matches the maintenance prefix and everything under it', async () => {
    vi.resetModules()
    const { isMaintenancePath } = await import('../../server/maintenance-gate')
    expect(isMaintenancePath('/wip/api/document-store/maintenance')).toBe(true)
    expect(isMaintenancePath(MAINTENANCE)).toBe(true)
    expect(isMaintenancePath('/wip/api/document-store/maintenance/requalify-identity-synonyms')).toBe(true)
  })

  it('matches spellings the upstream would still route to the endpoint', async () => {
    vi.resetModules()
    const { isMaintenancePath } = await import('../../server/maintenance-gate')
    expect(isMaintenancePath('/wip/api/document-store/./maintenance/rehash-identities')).toBe(true)
    expect(isMaintenancePath('/wip/api/document-store/documents/../maintenance/rehash-identities')).toBe(true)
    expect(isMaintenancePath('/wip/api/document-store/%2e/maintenance/rehash-identities')).toBe(true)
    expect(isMaintenancePath('/wip//api/document-store//maintenance/rehash-identities')).toBe(true)
    expect(isMaintenancePath('/WIP/API/Document-Store/Maintenance/rehash-identities')).toBe(true)
    expect(isMaintenancePath('/wip/api/document-store/%6Daintenance/rehash-identities')).toBe(true)
  })

  it('treats an undecodable path as maintenance', async () => {
    vi.resetModules()
    const { isMaintenancePath } = await import('../../server/maintenance-gate')
    expect(isMaintenancePath('/wip/api/document-store/%E0%A4%A')).toBe(true)
  })

  it('does not match other paths, including look-alike prefixes', async () => {
    vi.resetModules()
    const { isMaintenancePath } = await import('../../server/maintenance-gate')
    expect(isMaintenancePath('/wip/api/document-store/documents')).toBe(false)
    expect(isMaintenancePath('/wip/api/document-store/maintenance-notes')).toBe(false)
    expect(isMaintenancePath('/wip/api/registry/maintenance/rehash-identities')).toBe(false)
    expect(isMaintenancePath('/api/health')).toBe(false)
  })
})

describe('guardMaintenance', () => {
  it('admits an admin on a maintenance path', async () => {
    const s = await serve()
    const status = await s.get(MAINTENANCE, admin)
    await s.close()
    expect(status).toBe(200)
  })

  it('refuses a signed-in user outside the admin group', async () => {
    const s = await serve()
    const status = await s.get(MAINTENANCE, editor)
    await s.close()
    expect(status).toBe(403)
  })

  it('refuses the non-admin on odd spellings of the path too', async () => {
    const s = await serve()
    const statuses = await Promise.all([
      s.get('/wip/api/document-store/./maintenance/rehash-identities', editor),
      s.get('/wip/api/document-store/%2e/maintenance/rehash-identities', editor),
      s.get('/WIP/API/DOCUMENT-STORE/MAINTENANCE/rehash-identities', editor),
    ])
    await s.close()
    expect(statuses).toEqual([403, 403, 403])
  })

  it('leaves the other document-store paths open to a non-admin', async () => {
    const s = await serve()
    const status = await s.get('/wip/api/document-store/documents', editor)
    await s.close()
    expect(status).toBe(200)
  })

  it('passes everything in open dev mode (no auth configured)', async () => {
    const s = await serve()
    const status = await s.get(MAINTENANCE)
    await s.close()
    expect(status).toBe(200)
  })

  it('honours WIP_ADMIN_GROUPS', async () => {
    const s = await serve({ WIP_ADMIN_GROUPS: 'ops' })
    const ops = await s.get(MAINTENANCE, { 'X-WIP-User': 'o@wip.local', 'X-WIP-Groups': 'ops' })
    const wipAdmins = await s.get(MAINTENANCE, admin)
    await s.close()
    expect([ops, wipAdmins]).toEqual([200, 403])
  })
})
