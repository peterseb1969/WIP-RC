import { createWipClient } from '@wip/client'

/**
 * Base path prefix for all server requests: Vite's base without its
 * trailing slash. RC is served at the root of its own origin, so this is ''.
 * Requests still go through it, as the app contract asks of client fetches.
 */
export const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

/**
 * Prepend the base path to a server-relative URL.
 * Use for all direct fetch() calls (non-@wip/client).
 *
 *   apiUrl('/api/me')  →  '/api/me'
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
