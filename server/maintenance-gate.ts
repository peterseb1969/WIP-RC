import path from 'path'
import type { RequestHandler } from 'express'
import { requireAdmin } from './auth.js'

// The document-store maintenance endpoints (rehash identities, requalify
// identity synonyms) rewrite stored identities. WIP checks admin rights against
// whoever calls it, and behind this app's proxy that is always the deployment's
// admin key, so the check can never refuse a user. RC enforces admin itself.
const MAINTENANCE_PREFIX = '/wip/api/document-store/maintenance'

/**
 * Whether a request path, relative to the app's base path, targets a
 * maintenance endpoint. The path is decoded and normalized and compared
 * case-insensitively, so `/./`, `/../`, `%2e` and upper-case spellings cannot
 * slip past a prefix match that the upstream would still route to the endpoint.
 * A path that cannot be decoded counts as maintenance: guarding it is the safe error.
 */
export function isMaintenancePath(reqPath: string): boolean {
  let decoded: string
  try {
    decoded = decodeURIComponent(reqPath)
  } catch {
    return true
  }
  const p = path.posix.normalize(decoded).toLowerCase()
  return p === MAINTENANCE_PREFIX || p.startsWith(`${MAINTENANCE_PREFIX}/`)
}

/**
 * Middleware: requires an admin group (see requireAdmin) on maintenance paths and
 * lets every other path through. Mount it after requireAuth() and before the
 * WIP proxy.
 */
export function guardMaintenance(): RequestHandler {
  const admin = requireAdmin()
  return (req, res, next) => {
    if (isMaintenancePath(req.path)) admin(req, res, next)
    else next()
  }
}
