import { MongoServerError, type MongoClientOptions } from 'mongodb'
import { resolveSecret } from '../secret.js'

// How the console authenticates to MongoDB. WIP's MongoDB requires every
// client to log in as its own user; the console's user holds the built-in
// `read` role on the platform databases, so any write is refused by the
// server. The user lives in the `admin` database. Credentials are passed as
// client options, never in MONGO_URI, so they cannot end up in a logged URI.
//
//   MONGO_USER + (MONGO_PASSWORD_FILE | MONGO_PASSWORD)
//
// With no MONGO_USER the connection is anonymous (test containers, installs
// that predate MongoDB authentication). The password is resolved once per new
// client; the connector builds a new client after an authentication failure,
// which is how a rotated password is picked up.

export type MongoAuthMode = 'none' | 'user'

export interface MongoAuth {
  mode: MongoAuthMode
  /** The MongoDB username (not secret), for status display. */
  user?: string
  /** Client options carrying the credentials; contains the secret, never serialise it. */
  options?: Pick<MongoClientOptions, 'auth' | 'authSource'>
  /** A configuration problem that makes connecting pointless. */
  configError?: string
}

/** The console's MongoDB credentials from the environment. */
export function mongoAuthFromEnv(): MongoAuth {
  const user = process.env.MONGO_USER
  if (!user) return { mode: 'none' }
  const password = resolveSecret('MONGO_PASSWORD_FILE', 'MONGO_PASSWORD')
  if (!password) {
    return {
      mode: 'user',
      user,
      configError: 'MONGO_USER is set but no password was found (MONGO_PASSWORD_FILE or MONGO_PASSWORD)',
    }
  }
  return { mode: 'user', user, options: { auth: { username: user, password }, authSource: 'admin' } }
}

/**
 * Why MongoDB refused the console, if it was for authentication reasons:
 * `not_configured` — a command was refused for lack of authentication and no
 * credentials were sent; `rejected` — the credentials were refused (or missing
 * their password); `forbidden` — logged in, but the user lacks the privilege.
 */
export type MongoAuthError = 'not_configured' | 'rejected' | 'forbidden'

/** MongoDB server error codes for authentication outcomes. */
const UNAUTHORIZED = 13
const AUTHENTICATION_FAILED = 18

export function classifyMongoError(err: unknown, mode: MongoAuthMode): MongoAuthError | undefined {
  // The driver may wrap the server's error (e.g. in a server-selection error).
  for (let e: unknown = err, depth = 0; e && depth < 4; e = (e as { cause?: unknown }).cause, depth++) {
    if (!(e instanceof MongoServerError)) continue
    if (e.code === AUTHENTICATION_FAILED) return 'rejected'
    if (e.code === UNAUTHORIZED) return mode === 'none' ? 'not_configured' : 'forbidden'
  }
  return undefined
}

/**
 * True when `field` is a plain document path a filter may compare against.
 * Rejects any path segment starting with `$` — `$where` would run server-side
 * JavaScript, which the read-only role does not prevent — and empty segments.
 */
export function isSafeFilterField(field: string): boolean {
  if (!field || field.length > 200) return false
  return field.split('.').every(seg => seg.length > 0 && !seg.startsWith('$') && !seg.includes('\0'))
}
