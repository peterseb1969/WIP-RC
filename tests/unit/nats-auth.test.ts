/**
 * Tests for the console's NATS credential resolution and auth-error
 * classification (server/infra/nats-auth.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { NatsError, ErrorCode } from 'nats'
import { natsAuthFromEnv, natsInboxPrefix, classifyNatsError } from '../../server/infra/nats-auth'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'rc-nats-auth-'))
  for (const v of ['NATS_CREDS_FILE', 'NATS_USER', 'NATS_PASSWORD', 'NATS_PASSWORD_FILE', 'NATS_INBOX_PREFIX']) {
    vi.stubEnv(v, '')
  }
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

/** Run an authenticator the way the client does on connect. */
function authFields(auth: ReturnType<typeof natsAuthFromEnv>) {
  return auth.authenticator!('nonce') as unknown as Record<string, unknown>
}

describe('natsAuthFromEnv', () => {
  it('is anonymous when nothing is configured', () => {
    const auth = natsAuthFromEnv()
    expect(auth.mode).toBe('none')
    expect(auth.authenticator).toBeUndefined()
    expect(auth.configError).toBeUndefined()
  })

  it('reads the password from the file and re-reads it on every connect', () => {
    const file = path.join(dir, 'nats-password')
    writeFileSync(file, 'first\n')
    vi.stubEnv('NATS_USER', 'react-console')
    vi.stubEnv('NATS_PASSWORD_FILE', file)
    vi.stubEnv('NATS_PASSWORD', 'from-env')
    const auth = natsAuthFromEnv()
    expect(auth.mode).toBe('user')
    expect(auth.user).toBe('react-console')
    expect(auth.configError).toBeUndefined()
    expect(authFields(auth)).toEqual({ user: 'react-console', pass: 'first' })
    writeFileSync(file, 'rotated\n')
    expect(authFields(auth)).toEqual({ user: 'react-console', pass: 'rotated' })
  })

  it('falls back to NATS_PASSWORD when the file path does not exist (container case)', () => {
    vi.stubEnv('NATS_USER', 'react-console')
    vi.stubEnv('NATS_PASSWORD_FILE', path.join(dir, 'host-only-path'))
    vi.stubEnv('NATS_PASSWORD', 'from-env')
    expect(authFields(natsAuthFromEnv())).toEqual({ user: 'react-console', pass: 'from-env' })
  })

  it('reports a user without a password as a configuration error', () => {
    vi.stubEnv('NATS_USER', 'react-console')
    expect(natsAuthFromEnv().configError).toMatch(/no password/)
  })

  it('prefers a creds file over user/password', () => {
    vi.stubEnv('NATS_CREDS_FILE', path.join(dir, 'rc.creds'))
    vi.stubEnv('NATS_USER', 'react-console')
    vi.stubEnv('NATS_PASSWORD', 'x')
    const auth = natsAuthFromEnv()
    expect(auth.mode).toBe('creds')
    expect(auth.user).toBeUndefined()
  })

  it('never exposes the secret on the returned object', () => {
    vi.stubEnv('NATS_USER', 'react-console')
    vi.stubEnv('NATS_PASSWORD', 'top-secret')
    expect(JSON.stringify(natsAuthFromEnv())).not.toContain('top-secret')
  })
})

describe('natsInboxPrefix', () => {
  it('follows the NATS user, matching the per-user inbox grant', () => {
    vi.stubEnv('NATS_USER', 'react-console')
    expect(natsInboxPrefix()).toBe('_INBOX_react-console')
  })

  it('keeps the client default when anonymous or using a creds file', () => {
    expect(natsInboxPrefix()).toBe('_INBOX')
    vi.stubEnv('NATS_CREDS_FILE', path.join(dir, 'rc.creds'))
    vi.stubEnv('NATS_USER', 'react-console')
    expect(natsInboxPrefix()).toBe('_INBOX')
  })

  it('honours an explicit override', () => {
    vi.stubEnv('NATS_USER', 'react-console')
    vi.stubEnv('NATS_INBOX_PREFIX', '_INBOX_custom')
    expect(natsInboxPrefix()).toBe('_INBOX_custom')
  })
})

describe('classifyNatsError', () => {
  const authViolation = new NatsError('Authorization Violation', ErrorCode.AuthorizationViolation)

  it('calls an auth refusal not_configured when no credentials were sent', () => {
    expect(classifyNatsError(authViolation, 'none')).toBe('not_configured')
  })

  it('calls an auth refusal rejected when credentials were sent', () => {
    expect(classifyNatsError(authViolation, 'user')).toBe('rejected')
    expect(classifyNatsError(authViolation, 'creds')).toBe('rejected')
  })

  it('calls an unparseable creds file rejected', () => {
    expect(classifyNatsError(NatsError.errorForCode(ErrorCode.BadCreds), 'creds')).toBe('rejected')
  })

  it('leaves non-auth failures unclassified', () => {
    expect(classifyNatsError(NatsError.errorForCode(ErrorCode.ConnectionRefused), 'none')).toBeUndefined()
    expect(classifyNatsError(new Error('boom'), 'user')).toBeUndefined()
  })
})
