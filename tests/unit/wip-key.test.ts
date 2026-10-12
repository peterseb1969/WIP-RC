/**
 * Tests for resolveWipApiKey — the key source shared by the server's direct
 * WIP callers (infra probes, file/backup streaming, NL query tools).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { resolveWipApiKey } from '../../server/wip-key'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'rc-wip-key-'))
  vi.stubEnv('WIP_API_KEY', '')
  vi.stubEnv('WIP_API_KEY_FILE', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

describe('resolveWipApiKey', () => {
  it('prefers the key file, trimming the trailing newline', () => {
    const file = path.join(dir, 'api-key')
    writeFileSync(file, 'from-file\n')
    vi.stubEnv('WIP_API_KEY_FILE', file)
    vi.stubEnv('WIP_API_KEY', 'from-env')
    expect(resolveWipApiKey()).toBe('from-file')
  })

  it('falls back to WIP_API_KEY when the file path does not exist (container case)', () => {
    vi.stubEnv('WIP_API_KEY_FILE', path.join(dir, 'host-only-path'))
    vi.stubEnv('WIP_API_KEY', 'from-env')
    expect(resolveWipApiKey()).toBe('from-env')
  })

  it('falls back to WIP_API_KEY when the file is empty', () => {
    const file = path.join(dir, 'api-key')
    writeFileSync(file, '\n')
    vi.stubEnv('WIP_API_KEY_FILE', file)
    vi.stubEnv('WIP_API_KEY', 'from-env')
    expect(resolveWipApiKey()).toBe('from-env')
  })

  it('uses WIP_API_KEY when no file is configured', () => {
    vi.stubEnv('WIP_API_KEY', 'from-env')
    expect(resolveWipApiKey()).toBe('from-env')
  })
})
