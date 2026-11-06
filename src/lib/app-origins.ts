// Apps behind WIP are served either under WIP's own origin
// (https://<host>/apps/<name>/, "path" mode) or each on an origin of its own
// (https://<name>.<host>/apps/<name>/, "subdomain" mode, the default for new
// installs). In subdomain mode WIP's /apps/<name>/ answers 301, and a path
// on RC's own origin reaches only RC. Logging in happens on WIP's origin,
// reached through the gateway's handshake when a page of the app is loaded.

/** The app's label from its base path: '/apps/rc' -> 'rc'. Null when not under /apps/. */
export function appLabel(basePath: string): string | null {
  const m = /^\/apps\/([^/]+)\/?$/.exec(basePath)
  return m?.[1] ?? null
}

interface Where { protocol: string; hostname: string; port: string }

/**
 * Where another app of this install is opened, from RC's own location. If
 * RC is on its own origin (`<label>.<host>`), the other app is on
 * `<name>.<host>`; otherwise it is under WIP's origin at /apps/<name>/.
 */
export function appUrl(name: string, where: Where, basePath: string): string {
  const own = appLabel(basePath)
  const prefix = own ? `${own}.` : null
  if (prefix && where.hostname.startsWith(prefix) && where.hostname.length > prefix.length) {
    const host = where.hostname.slice(prefix.length)
    return `${where.protocol}//${name}.${host}${where.port ? `:${where.port}` : ''}/apps/${name}/`
  }
  return `/apps/${name}/`
}

/** How long a reload for a lost session counts as recent; a 401 again within it stops the reloads. */
export const RELOGIN_WINDOW_MS = 30_000

/**
 * Whether to reload the page to log in again after the gateway answered 401.
 * Reloading RC's own URL works in both modes: the gateway sends the browser
 * through its login (path mode) or its handshake (subdomain mode, where
 * /auth/login does not exist on the app's origin). A second 401 soon after a
 * reload means reloading doesn't help, so it isn't repeated.
 */
export function shouldReloadForLogin(now: number, lastReload: number | null): boolean {
  return lastReload === null || now - lastReload > RELOGIN_WINDOW_MS
}
