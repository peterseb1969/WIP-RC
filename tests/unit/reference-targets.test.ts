/**
 * Tests for resolving a reference field's target template: by id, by
 * ns:VALUE, and a bare value in the referring document's namespace only;
 * a term field's terminology_ref by the same rules.
 */
import { describe, it, expect } from 'vitest'
import { resolveTargetTemplate, resolveTerminologyRef } from '../../src/lib/reference-targets'

const templates = [
  { template_id: 'id-kb', namespace: 'kb', value: 'CASE_RECORD' },
  { template_id: 'id-proj', namespace: 'dev-proj-a', value: 'CASE_RECORD' },
  { template_id: 'id-wip', namespace: 'wip', value: 'PERSON' },
]

describe('resolveTargetTemplate', () => {
  it('matches a canonical id exactly', () => {
    expect(resolveTargetTemplate('id-proj', templates, 'kb')?.template_id).toBe('id-proj')
  })

  it('resolves a bare value in the given namespace, not the first one listed', () => {
    expect(resolveTargetTemplate('CASE_RECORD', templates, 'dev-proj-a')?.template_id).toBe('id-proj')
  })

  it('does not fall back to another namespace for a bare value', () => {
    expect(resolveTargetTemplate('PERSON', templates, 'kb')).toBeUndefined()
  })

  it('resolves ns:VALUE in the named namespace', () => {
    expect(resolveTargetTemplate('wip:PERSON', templates, 'kb')?.template_id).toBe('id-wip')
    expect(resolveTargetTemplate('kb:CASE_RECORD', templates, 'dev-proj-a')?.template_id).toBe('id-kb')
  })

  it('falls back to the first match by value when no namespace is known', () => {
    expect(resolveTargetTemplate('CASE_RECORD', templates)?.template_id).toBe('id-kb')
  })
})

describe('resolveTerminologyRef', () => {
  const terminologies = [
    { terminology_id: 'tid-kb', namespace: 'kb', value: 'KB_TOPIC' },
    { terminology_id: 'tid-proj', namespace: 'dev-proj-a', value: 'KB_TOPIC' },
    { terminology_id: 'tid-wip', namespace: 'wip', value: 'COUNTRY' },
  ]

  it('matches a canonical id exactly, whatever the namespace', () => {
    expect(resolveTerminologyRef('tid-wip', terminologies, 'kb')?.terminology_id).toBe('tid-wip')
  })

  it('resolves a bare value in the document namespace, not the first one listed', () => {
    expect(resolveTerminologyRef('KB_TOPIC', terminologies, 'dev-proj-a')?.terminology_id).toBe('tid-proj')
  })

  it('does not fall back to another namespace for a bare value', () => {
    expect(resolveTerminologyRef('COUNTRY', terminologies, 'kb')).toBeUndefined()
  })

  it('resolves ns:VALUE in the named namespace', () => {
    expect(resolveTerminologyRef('wip:COUNTRY', terminologies, 'kb')?.terminology_id).toBe('tid-wip')
  })
})
