import { describe, it, expect } from 'vitest'
import {
  buildCreateNamespaces,
  defaultDraft,
  draftToSettings,
  emptyRow,
  guardedWarnings,
  narrowOutcome,
  type NamespaceRow,
} from '@/lib/key-reservations'

const row = (prefix: string, reserve = false, draft = defaultDraft()): NamespaceRow => ({ prefix, reserve, draft })
const none = new Set<string>()

describe('draftToSettings', () => {
  it('sends nothing for the defaults', () => {
    expect(draftToSettings(defaultDraft())).toEqual({ settings: {} })
  })

  it('sends only what differs from the defaults', () => {
    const draft = {
      ...defaultDraft(),
      description: ' My app ',
      isolation_mode: 'strict' as const,
      allowed_external_refs: 'wip, shared ,',
      deletion_mode: 'full' as const,
      id_config: '{"documents": {"algorithm": "prefixed", "prefix": "APP-"}}',
    }
    expect(draftToSettings(draft)).toEqual({
      settings: {
        description: 'My app',
        isolation_mode: 'strict',
        allowed_external_refs: ['wip', 'shared'],
        deletion_mode: 'full',
        id_config: { documents: { algorithm: 'prefixed', prefix: 'APP-' } },
      },
    })
  })

  it('refuses ID config that is not a JSON object', () => {
    expect(draftToSettings({ ...defaultDraft(), id_config: '{nope' })).toEqual({ error: 'ID config is not valid JSON' })
    expect(draftToSettings({ ...defaultDraft(), id_config: '[1]' })).toEqual({ error: 'ID config must be a JSON object' })
    expect(draftToSettings({ ...defaultDraft(), id_config: '' })).toEqual({ settings: {} })
  })
})

describe('guardedWarnings', () => {
  it('warns on full deletion and open inbound references only', () => {
    expect(guardedWarnings(defaultDraft())).toEqual([])
    const warnings = guardedWarnings({ ...defaultDraft(), deletion_mode: 'full', inbound_references: 'open' })
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toMatch(/hard deletes/)
    expect(warnings[1]).toMatch(/any writer/)
  })
})

describe('buildCreateNamespaces', () => {
  it('makes an unscoped key from no rows or blank rows', () => {
    expect(buildCreateNamespaces([], none, 'write')).toEqual({ fields: {} })
    expect(buildCreateNamespaces([emptyRow(), row('  ')], none, 'write')).toEqual({ fields: {} })
  })

  it('grants the permission on plain namespaces', () => {
    expect(buildCreateNamespaces([row(' a '), row('b')], none, 'write')).toEqual({
      fields: { namespaces: ['a', 'b'], grant_permission: 'write' },
    })
    expect(buildCreateNamespaces([row('a')], none, '')).toEqual({ fields: { namespaces: ['a'] } })
  })

  it('reserves marked namespaces and grants only when a plain one is left', () => {
    const strict = { ...defaultDraft(), isolation_mode: 'strict' as const }
    expect(buildCreateNamespaces([row('app', true, strict), row('other', true)], none, 'write')).toEqual({
      fields: {
        namespaces: ['app', 'other'],
        reserve: [{ prefix: 'app', settings: { isolation_mode: 'strict' } }, { prefix: 'other' }],
      },
    })
    expect(buildCreateNamespaces([row('app', true), row('lib')], none, 'read')).toEqual({
      fields: { namespaces: ['app', 'lib'], reserve: [{ prefix: 'app' }], grant_permission: 'read' },
    })
  })

  it('refuses a duplicate, a reserved namespace that exists, and bad settings', () => {
    expect(buildCreateNamespaces([row('a'), row('a ')], none, 'write')).toEqual({ error: 'Namespace "a" is listed twice' })
    const exists = buildCreateNamespaces([row('kb', true)], new Set(['kb']), 'write')
    expect('error' in exists && exists.error).toMatch(/exists, so it can't be reserved/)
    // An existing namespace is fine when not reserved.
    expect(buildCreateNamespaces([row('kb')], new Set(['kb']), 'admin')).toEqual({
      fields: { namespaces: ['kb'], grant_permission: 'admin' },
    })
    expect(buildCreateNamespaces([row('app', true, { ...defaultDraft(), id_config: 'x' })], none, '')).toEqual({
      error: 'app: ID config is not valid JSON',
    })
  })
})

describe('narrowOutcome', () => {
  const base = { name: 'k', prefix: 'app', namespaces: [] }
  it('names what happened to the reservation', () => {
    expect(narrowOutcome({ ...base, reservation: 'released' })).toMatch(/released its reservation/)
    expect(narrowOutcome({ ...base, reservation: 'kept' })).toMatch(/kept because the namespace exists/)
    expect(narrowOutcome({ ...base, reservation: null })).toBe('Removed app and its grant.')
  })
})
