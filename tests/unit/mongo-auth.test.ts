/**
 * Tests for the console's MongoDB credential resolution, auth-error
 * classification and filter-field guard (server/infra/mongo-auth.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { MongoServerError, MongoServerSelectionError } from 'mongodb'
import { mongoAuthFromEnv, classifyMongoError, isSafeFilterField } from '../../server/infra/mongo-auth'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'rc-mongo-auth-'))
  for (const v of ['MONGO_USER', 'MONGO_PASSWORD', 'MONGO_PASSWORD_FILE']) vi.stubEnv(v, '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

const serverError = (code: number, message: string) => new MongoServerError({ ok: 0, code, errmsg: message })

describe('mongoAuthFromEnv', () => {
  it('is anonymous without MONGO_USER', () => {
    expect(mongoAuthFromEnv()).toEqual({ mode: 'none' })
  })

  it('passes the user and password as client options against the admin database', () => {
    vi.stubEnv('MONGO_USER', 'react-console')
    vi.stubEnv('MONGO_PASSWORD', 'from-env')
    expect(mongoAuthFromEnv()).toEqual({
      mode: 'user',
      user: 'react-console',
      options: { auth: { username: 'react-console', password: 'from-env' }, authSource: 'admin' },
    })
  })

  it('prefers the password file, and re-reads it for each new client', () => {
    const file = path.join(dir, 'mongo-password')
    writeFileSync(file, 'first\n')
    vi.stubEnv('MONGO_USER', 'react-console')
    vi.stubEnv('MONGO_PASSWORD_FILE', file)
    vi.stubEnv('MONGO_PASSWORD', 'from-env')
    expect(mongoAuthFromEnv().options?.auth?.password).toBe('first')
    writeFileSync(file, 'rotated\n')
    expect(mongoAuthFromEnv().options?.auth?.password).toBe('rotated')
  })

  it('falls back to MONGO_PASSWORD when the file path does not exist (container case)', () => {
    vi.stubEnv('MONGO_USER', 'react-console')
    vi.stubEnv('MONGO_PASSWORD_FILE', path.join(dir, 'host-only-path'))
    vi.stubEnv('MONGO_PASSWORD', 'from-env')
    expect(mongoAuthFromEnv().options?.auth?.password).toBe('from-env')
  })

  it('reports a user without a password as a configuration error, with no options', () => {
    vi.stubEnv('MONGO_USER', 'react-console')
    const auth = mongoAuthFromEnv()
    expect(auth.configError).toMatch(/no password/)
    expect(auth.options).toBeUndefined()
  })
})

describe('classifyMongoError', () => {
  it('calls an unauthenticated command not_configured when no credentials were sent', () => {
    expect(classifyMongoError(serverError(13, 'Command listCollections requires authentication'), 'none')).toBe('not_configured')
  })

  it('calls an unauthorized command forbidden when logged in', () => {
    expect(classifyMongoError(serverError(13, 'not authorized on wip_registry'), 'user')).toBe('forbidden')
  })

  it('calls a failed login rejected, also when the driver wraps it', () => {
    const failed = serverError(18, 'Authentication failed.')
    expect(classifyMongoError(failed, 'user')).toBe('rejected')
    const wrapped = new MongoServerSelectionError('Server selection timed out', { type: 'Unknown', servers: new Map(), stale: false, compatible: true, heartbeatFrequencyMS: 10000, localThresholdMS: 15, setName: null, maxElectionId: null, maxSetVersion: null, commonWireVersion: 0, logicalSessionTimeoutMinutes: null } as never)
    ;(wrapped as { cause?: unknown }).cause = failed
    expect(classifyMongoError(wrapped, 'user')).toBe('rejected')
  })

  it('leaves other failures unclassified', () => {
    expect(classifyMongoError(serverError(26, 'ns does not exist'), 'user')).toBeUndefined()
    expect(classifyMongoError(new Error('connect ECONNREFUSED'), 'none')).toBeUndefined()
  })
})

describe('isSafeFilterField', () => {
  it('accepts plain and dotted paths', () => {
    expect(isSafeFilterField('status')).toBe(true)
    expect(isSafeFilterField('data.case_number')).toBe(true)
  })

  it('rejects operators anywhere in the path', () => {
    expect(isSafeFilterField('$where')).toBe(false)
    expect(isSafeFilterField('data.$where')).toBe(false)
    expect(isSafeFilterField('$expr')).toBe(false)
  })

  it('rejects empty, malformed and oversized paths', () => {
    expect(isSafeFilterField('')).toBe(false)
    expect(isSafeFilterField('a..b')).toBe(false)
    expect(isSafeFilterField('.a')).toBe(false)
    expect(isSafeFilterField('a\0b')).toBe(false)
    expect(isSafeFilterField('x'.repeat(201))).toBe(false)
  })
})
