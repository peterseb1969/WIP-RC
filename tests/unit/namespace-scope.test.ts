import { describe, it, expect } from 'vitest'
import { namespaceScope } from '@/lib/namespace-scope'

// The top-bar selector used to be disabled only on the three infrastructure
// pages and looked active everywhere else, including pages that never read it.
// These pin the per-page decisions Peter approved: live where it filters or
// scopes a create, disabled with a reason everywhere else.

const applies = (p: string) => namespaceScope(p).applies

describe('namespaceScope', () => {
  it.each([
    '/', '/terminologies', '/templates', '/templates/new', '/documents',
    '/documents/import', '/documents/PERSON/table', '/documents/PERSON/new',
    '/files', '/registry', '/backup',
  ])('applies on %s', p => {
    expect(applies(p)).toBe(true)
  })

  it.each([
    '/namespaces', '/integrity', '/activity', '/audit-explorer', '/query', '/api-keys',
    '/terminologies/abc', '/terminologies/abc/terms/def', '/templates/abc',
    '/templates/abc/edit', '/documents/PERSON/abc', '/documents/PERSON/abc/edit',
    '/files/abc', '/postgres', '/mongodb', '/nats',
  ])('does not apply on %s', p => {
    expect(applies(p)).toBe(false)
  })

  it('tells the document form apart from document detail', () => {
    // '/documents/:templateValue/new' and '/documents/:templateValue/:id' share a shape.
    expect(applies('/documents/PERSON/new')).toBe(true)
    expect(applies('/documents/PERSON/019a-doc-id')).toBe(false)
  })

  it('gives each kind of page its own reason', () => {
    const reason = (p: string) => {
      const s = namespaceScope(p)
      return s.applies ? null : s.reason
    }
    expect(reason('/postgres')).toMatch(/across all namespaces/)
    expect(reason('/mongodb/collections')).toMatch(/across all namespaces/)
    expect(reason('/files/abc')).toMatch(/one item in its own namespace/)
    expect(reason('/integrity')).toBe('The namespace filter does not apply on this page.')
  })

  it('treats an unknown page as not applying (allowlist, not blocklist)', () => {
    expect(applies('/some-future-page')).toBe(false)
  })
})
