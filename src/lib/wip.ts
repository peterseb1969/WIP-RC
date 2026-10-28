import { createWipClient } from '@wip/client'

/**
 * Base path prefix for all server requests. Set by Vite's `base` config
 * (via VITE_BASE_PATH env var). In dev: ''. In production behind
 * Caddy at /apps/rc: '/apps/rc'.
 */
export const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

/**
 * Prepend the base path to a server-relative URL.
 * Use for all direct fetch() calls (non-@wip/client).
 *
 *   apiFetch('/api/me')  →  '/apps/rc/api/me' (production)
 *   apiFetch('/api/me')  →  '/api/me' (dev)
 */
export function apiUrl(path: string): string {
  return `${basePath}${path}`
}

/**
 * The app's @wip/client instance. Talks to the Express backend's `/wip` proxy,
 * never to WIP directly — the proxy injects the API key server-side, so no
 * credential reaches the browser.
 */
export const wipClient = createWipClient({
  baseUrl: `${basePath}/wip`,
  // auth omitted — wip-proxy injects the API key server-side
})

/**
 * Same proxy, with a request timeout long enough for the document-store
 * maintenance passes. Those calls are synchronous and grow with the namespace;
 * under the shared client's 30 s timeout the browser gives up while the server
 * keeps working, and the operator is left unsure whether anything was written.
 * Only GETs are retried by the client, so a maintenance POST is never repeated.
 */
export const maintenanceClient = createWipClient({
  baseUrl: `${basePath}/wip`,
  timeout: 300_000,
})
