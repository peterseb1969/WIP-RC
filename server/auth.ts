/**
 * OIDC authentication middleware for WIP apps.
 *
 * When OIDC_ISSUER is set, redirects unauthenticated users to Dex login.
 * After login, sets X-WIP-User and X-WIP-Groups on the request so
 * @wip/proxy can forward them to WIP services.
 *
 * When OIDC_ISSUER is not set, auth is disabled (local dev mode).
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import * as client from 'openid-client'

// Session augmentation for TypeScript
declare module 'express-session' {
  interface SessionData {
    user?: { email: string; groups: string[]; name?: string }
    returnTo?: string
  }
}

let oidcConfig: client.Configuration | null = null

const OIDC_ISSUER = process.env.OIDC_ISSUER
/** Internal issuer URL for server-to-server discovery (e.g. http://wip-dex:5556/dex).
 *  Falls back to OIDC_ISSUER. Needed when OIDC_ISSUER uses 'localhost' which
 *  resolves to the container itself, not the host machine. */
const OIDC_INTERNAL_ISSUER = process.env.OIDC_INTERNAL_ISSUER || OIDC_ISSUER
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || 'wip-apps'
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || 'wip-apps-secret'

/** Base path when running behind a reverse proxy (e.g. /apps/rc). No trailing slash. */
const BASE_PATH = (process.env.APP_BASE_PATH || '').replace(/\/$/, '')

/** Comma-separated list of Dex groups allowed to access this app. Empty = all authenticated users. */
const ALLOWED_GROUPS = process.env.ALLOWED_GROUPS
  ? process.env.ALLOWED_GROUPS.split(',').map(g => g.trim()).filter(Boolean)
  : []

/** Public paths that skip authentication */
// Matched against the router-relative path. The health probes must stay
// public or an OIDC-mode container redirects its own healthcheck to Dex.
const PUBLIC_PATHS = ['/health', '/api/health', '/auth/callback', '/auth/logout']

/** Groups from the X-WIP-Groups identity header (set by the auth gateway, or by requireAuth in OIDC mode). */
function headerGroups(req: Request): string[] {
  return (req.headers['x-wip-groups'] as string || '').split(',').map(g => g.trim()).filter(Boolean)
}

function denyNotInAllowedGroups(res: Response): void {
  res.status(403).json({
    error: 'Access denied',
    message: `You don't have access to this app. Required group: ${ALLOWED_GROUPS.join(' or ')}`,
  })
}

/** Comma-separated Dex/gateway groups treated as admins. Default: wip-admins. */
const ADMIN_GROUPS = (process.env.WIP_ADMIN_GROUPS || 'wip-admins')
  .split(',').map(g => g.trim()).filter(Boolean)

/**
 * Require the caller to be in an admin group (mirrors APP-KB's requireAdmin,
 * CASE-508). Reads identity from X-WIP-Groups — set by the gateway, or by
 * requireAuth() above in OIDC mode — falling back to the session. When no auth
 * is configured at all (local dev: no OIDC issuer and no gateway header), it
 * passes through so development isn't blocked.
 */
export function requireAdmin(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const gwUser = req.headers['x-wip-user'] as string | undefined
    const gwGroups = headerGroups(req)
    const sessionGroups = req.session?.user?.groups ?? []
    const groups = gwGroups.length ? gwGroups : sessionGroups

    const authEnabled = !!OIDC_ISSUER || !!gwUser
    if (!authEnabled) { next(); return } // open dev mode

    if (groups.some(g => ADMIN_GROUPS.includes(g))) { next(); return }
    res.status(403).json({ error: 'Administrator access required' })
  }
}

/**
 * Initialize OIDC client. Call once at startup.
 * Returns true if auth is enabled, false if OIDC_ISSUER is not set.
 */
export async function initAuth(): Promise<boolean> {
  if (!OIDC_ISSUER) {
    console.log('[auth] OIDC_ISSUER not set — using gateway auth (X-WIP-User headers) or dev mode')
    return false
  }

  // Discovery uses the external issuer URL (what Dex puts in its 'issuer'
  // claim). If OIDC_INTERNAL_ISSUER is set, we intercept fetch calls during
  // discovery and JWKS retrieval to route them through the internal network
  // while keeping the issuer identity as the external URL.
  const issuer = new URL(OIDC_ISSUER)
  const internalOrigin = OIDC_INTERNAL_ISSUER && OIDC_INTERNAL_ISSUER !== OIDC_ISSUER
    ? new URL(OIDC_INTERNAL_ISSUER).origin
    : null
  const externalOrigin = issuer.origin

  const discoveryOptions: Record<string, unknown> = {}
  if (internalOrigin) {
    // Rewrite fetch URLs from external → internal origin so discovery and
    // JWKS requests reach Dex via the container network, while the issuer
    // identity stays as the external URL (no issuer mismatch).
    discoveryOptions[client.customFetch as unknown as string] = (url: string | URL, init?: RequestInit) => {
      const rewritten = String(url).replace(externalOrigin, internalOrigin)
      console.log(`[auth] OIDC fetch: ${url} → ${rewritten}`)
      return fetch(rewritten, init)
    }
    // Internal Dex uses HTTP, not HTTPS
    discoveryOptions.execute = [client.allowInsecureRequests]
  }
  oidcConfig = await client.discovery(issuer, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, undefined, discoveryOptions as Parameters<typeof client.discovery>[4])
  if (internalOrigin) {
    // Also allow insecure requests for token exchange etc.
    client.allowInsecureRequests(oidcConfig)
  }
  const groupInfo = ALLOWED_GROUPS.length > 0
    ? `allowed_groups=[${ALLOWED_GROUPS.join(', ')}]`
    : 'allowed_groups=* (all authenticated users)'
  console.log(`[auth] OIDC configured: issuer=${OIDC_ISSUER}${internalOrigin ? `, internal=${internalOrigin}` : ''}, client=${OIDC_CLIENT_ID}, ${groupInfo}`)
  return true
}

/**
 * Get the callback URL for OIDC redirects.
 */
function getCallbackUrl(req: Request): string {
  const proto = req.headers['x-forwarded-proto'] || req.protocol
  const host = req.headers['x-forwarded-host'] || req.get('host')
  return `${proto}://${host}${BASE_PATH}/auth/callback`
}

/**
 * Express middleware that authenticates requests and applies ALLOWED_GROUPS.
 *
 * - OIDC mode (OIDC_ISSUER set): unauthenticated users are sent to Dex; the
 *   session's groups must include an allowed group.
 * - Gateway mode (no OIDC_ISSUER, behind the WIP auth gateway): identity
 *   arrives in X-WIP-User / X-WIP-Groups, and the groups header must include
 *   an allowed group. With ALLOWED_GROUPS set, a request carrying no identity
 *   is refused rather than treated as dev mode, so reaching the container
 *   without passing the gateway does not grant access.
 * - Dev mode (neither, and no ALLOWED_GROUPS): everything passes.
 *
 * PUBLIC_PATHS (health probes, auth callbacks) always pass.
 */
export function requireAuth(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Public paths skip auth
    if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) {
      next()
      return
    }

    if (!oidcConfig) {
      if (ALLOWED_GROUPS.length === 0) { next(); return }
      if (!req.headers['x-wip-user']) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Sign in through the WIP gateway to use this app.',
        })
        return
      }
      if (!headerGroups(req).some(g => ALLOWED_GROUPS.includes(g))) { denyNotInAllowedGroups(res); return }
      next()
      return
    }

    // Already authenticated — check app-level access, then inject identity headers
    if (req.session.user) {
      if (ALLOWED_GROUPS.length > 0 && !req.session.user.groups.some(g => ALLOWED_GROUPS.includes(g))) {
        denyNotInAllowedGroups(res)
        return
      }
      req.headers['x-wip-user'] = req.session.user.email
      req.headers['x-wip-groups'] = req.session.user.groups.join(',')
      req.headers['x-wip-auth-method'] = 'gateway_oidc'
      next()
      return
    }

    // Not authenticated — redirect to Dex
    const callbackUrl = getCallbackUrl(req)
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = client.calculatePKCECodeChallenge(codeVerifier)
    const state = client.randomState()

    // Store PKCE verifier, state, and return URL in session
    req.session.returnTo = req.originalUrl
    ;(req.session as any).codeVerifier = codeVerifier
    ;(req.session as any).oauthState = state

    codeChallenge.then(challenge => {
      const params = new URLSearchParams({
        client_id: OIDC_CLIENT_ID,
        response_type: 'code',
        redirect_uri: callbackUrl,
        scope: 'openid email profile groups',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
      })

      const authUrl = `${oidcConfig!.serverMetadata().authorization_endpoint}?${params}`
      res.redirect(authUrl)
    }).catch(next)
  }
}

/**
 * Handle OIDC callback — exchange code for tokens, create session.
 */
export async function handleCallback(req: Request, res: Response): Promise<void> {
  if (!oidcConfig) {
    res.status(500).json({ error: 'Auth not configured' })
    return
  }

  try {
    const callbackUrl = getCallbackUrl(req)
    const codeVerifier = (req.session as any).codeVerifier
    const expectedState = (req.session as any).oauthState

    const callbackParams = new URLSearchParams(req.url.split('?')[1] || '')
    const tokens = await client.authorizationCodeGrant(
      oidcConfig,
      new URL(`${callbackUrl}?${callbackParams}`),
      { pkceCodeVerifier: codeVerifier, expectedState },
    )

    const claims = tokens.claims()!
    const groups = (claims as any).groups || []

    req.session.user = {
      email: claims.email as string || claims.sub,
      groups: Array.isArray(groups) ? groups : [groups],
      name: claims.name as string | undefined,
    }

    // Clean up PKCE verifier and state
    delete (req.session as any).codeVerifier
    delete (req.session as any).oauthState

    const returnTo = req.session.returnTo || '/'
    delete req.session.returnTo
    res.redirect(returnTo)
  } catch (err) {
    console.error('[auth] Callback error:', err)
    res.status(401).json({ error: 'Authentication failed' })
  }
}

/**
 * Handle logout — destroy session and optionally redirect to Dex end-session.
 */
export function handleLogout(req: Request, res: Response): void {
  const returnTo = typeof req.query.return_to === 'string' && req.query.return_to.startsWith('/')
    ? req.query.return_to
    : (process.env.APP_BASE_PATH || '/') + '/'
  req.session.destroy(() => {
    res.redirect(returnTo)
  })
}
