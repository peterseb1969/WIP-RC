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

export const wipClient = createWipClient({
  baseUrl: `${basePath}/wip`,
  // auth omitted — wip-proxy injects the API key server-side
})
