/**
 * Tests for naming a document in compact views: header fields first, then
 * identity fields, then a common naming key, then the id.
 */
import { describe, it, expect } from 'vitest'
import { documentLabel } from '../../src/lib/document-label'

const doc = (data: Record<string, unknown>, custom?: Record<string, unknown>) =>
  ({ document_id: '019f00c4-0f56-7df7-9d8a', data, metadata: custom ? { custom } : undefined })

describe('documentLabel', () => {
  it('uses the first non-empty header field', () => {
    expect(documentLabel(doc({ title: '', name: 'Ada' }), { header_fields: ['title', 'name'], identity_fields: ['code'] })).toBe('Ada')
  })

  it('reads metadata.custom and nested header paths', () => {
    expect(documentLabel(doc({}, { label: 'From metadata' }), { header_fields: ['metadata.custom.label'] })).toBe('From metadata')
    expect(documentLabel(doc({ person: { name: 'Nested' } }), { header_fields: ['data.person.name'] })).toBe('Nested')
  })

  it('joins identity field values when no header fields are declared', () => {
    expect(documentLabel(doc({ code: 'AB', year: 2026, note: 'x' }), { identity_fields: ['code', 'year'] })).toBe('AB · 2026')
  })

  it('falls back to a naming key, then to the id', () => {
    expect(documentLabel(doc({ title: 'Plain' }), {})).toBe('Plain')
    expect(documentLabel(doc({ count: 3 }))).toBe('019f00c4')
  })

  it('does not fall back to identity fields when header fields are declared but empty', () => {
    expect(documentLabel(doc({ code: 'AB' }), { header_fields: ['title'], identity_fields: ['code'] })).toBe('019f00c4')
  })
})
