import { readFileSync } from 'fs'
import {
  credsAuthenticator,
  usernamePasswordAuthenticator,
  NatsError,
  ErrorCode,
  type Authenticator,
} from 'nats'
import { resolveSecret } from '../secret.js'

// How the console authenticates to NATS. Credentials are optional: with none
// configured the connection is anonymous, which is what NATS accepts until it
// requires authentication (and during the transition window when it accepts
// both). Credentials are passed as connect options, never in NATS_URL, so they
// cannot end up in a logged URL.
//
// Sources, first match wins:
//   NATS_CREDS_FILE                              → JWT + nkey creds file
//   NATS_USER + (NATS_PASSWORD_FILE | NATS_PASSWORD) → user/password
//
// Secrets are read through functions, which the client calls on every connect
// and reconnect, so a rotated file is picked up without restarting the server.

export type NatsAuthMode = 'none' | 'user' | 'creds'

export interface NatsAuth {
  mode: NatsAuthMode
  /** The NATS username (not secret), for status display. */
  user?: string
  authenticator?: Authenticator
  /** A configuration problem that makes connecting pointless. */
  configError?: string
}

/** The console's NATS credentials from the environment. Never contains the secret itself. */
export function natsAuthFromEnv(): NatsAuth {
  const credsFile = process.env.NATS_CREDS_FILE
  if (credsFile) {
    return {
      mode: 'creds',
      authenticator: credsAuthenticator(() => readFileSync(credsFile)),
    }
  }
  const user = process.env.NATS_USER
  if (user) {
    const password = () => resolveSecret('NATS_PASSWORD_FILE', 'NATS_PASSWORD')
    return {
      mode: 'user',
      user,
      authenticator: usernamePasswordAuthenticator(user, password),
      configError: password()
        ? undefined
        : 'NATS_USER is set but no password was found (NATS_PASSWORD_FILE or NATS_PASSWORD)',
    }
  }
  return { mode: 'none' }
}

/**
 * Reply-subject prefix for JetStream requests. wip-deploy grants each NATS
 * user subscribe rights on `_INBOX_<user>.>` only, so the prefix must follow
 * the user name; NATS_INBOX_PREFIX overrides it (for a creds-file identity,
 * whose name is not in the environment). Anonymous connections keep the
 * client's default `_INBOX`.
 */
export function natsInboxPrefix(): string {
  if (process.env.NATS_INBOX_PREFIX) return process.env.NATS_INBOX_PREFIX
  if (!process.env.NATS_CREDS_FILE && process.env.NATS_USER) return `_INBOX_${process.env.NATS_USER}`
  return '_INBOX'
}

/**
 * Why NATS refused the console, if it was an authentication refusal:
 * `not_configured` when no credentials were sent, `rejected` when the ones
 * sent were refused or could not be read.
 */
export type NatsAuthError = 'not_configured' | 'rejected'

export function classifyNatsError(err: unknown, mode: NatsAuthMode): NatsAuthError | undefined {
  if (!(err instanceof NatsError)) return undefined
  if (err.isAuthError() || err.isAuthTimeout()) return mode === 'none' ? 'not_configured' : 'rejected'
  if (err.code === ErrorCode.BadCreds) return 'rejected'
  return undefined
}
