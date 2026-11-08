// Every app behind WIP is served at the root of an origin of its own,
// https://<label>.<host>[:port]/, and RC is one of them (rc.<host>). A path
// on RC's origin reaches only RC. Logging in happens on WIP's origin,
// reached through the gateway's handshake when a page of the app is loaded.

interface Where { protocol: string; hostname: string; port: string }

/**
 * The install's hostname, from RC's own location: RC's hostname without its
 * first label (rc.wip.localhost -> wip.localhost). Null for a hostname with
 * no dot, which no install serves apps on (the dev server at localhost).
 */
export function installHost(hostname: string): string | null {
  const dot = hostname.indexOf('.')
  return dot > 0 && dot < hostname.length - 1 ? hostname.slice(dot + 1) : null
}

/** Where another app of this install is opened: https://<name>.<host>[:port]/, or null if RC isn't on an app origin. */
export function appUrl(name: string, where: Where): string | null {
  const host = installHost(where.hostname)
  if (!host) return null
  return `${where.protocol}//${name}.${host}${where.port ? `:${where.port}` : ''}/`
}

/** How long a reload for a lost session counts as recent; a 401 again within it stops the reloads. */
export const RELOGIN_WINDOW_MS = 30_000

/**
 * Whether to reload the page to log in again after the gateway answered 401.
 * Reloading RC's own URL sends the browser through the gateway's handshake
 * (/auth/login does not exist on an app's origin). A second 401 soon after a
 * reload means reloading doesn't help, so it isn't repeated.
 */
export function shouldReloadForLogin(now: number, lastReload: number | null): boolean {
  return lastReload === null || now - lastReload > RELOGIN_WINDOW_MS
}
