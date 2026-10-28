import { describe, it, expect } from 'vitest'
import {
  applyBlockReason,
  previewIsCurrent,
  registryOutcome,
  shortHash,
  summarizeRegistry,
} from '@/lib/identity-rehash'

describe('previewIsCurrent', () => {
  const previewed = { namespace: 'ns-a', templates: ['B', 'A'] }

  it('is current for the same namespace and templates, in any order', () => {
    expect(previewIsCurrent(previewed, { namespace: 'ns-a', templates: ['A', 'B'] })).toBe(true)
  })

  it('treats an empty filter on both sides as the same scope', () => {
    expect(previewIsCurrent({ namespace: 'ns-a', templates: [] }, { namespace: 'ns-a', templates: [] })).toBe(true)
  })

  it('is stale when the namespace changed', () => {
    expect(previewIsCurrent(previewed, { namespace: 'ns-b', templates: ['A', 'B'] })).toBe(false)
  })

  it('is stale when a template was added, removed or swapped', () => {
    expect(previewIsCurrent(previewed, { namespace: 'ns-a', templates: ['A'] })).toBe(false)
    expect(previewIsCurrent(previewed, { namespace: 'ns-a', templates: ['A', 'B', 'C'] })).toBe(false)
    expect(previewIsCurrent(previewed, { namespace: 'ns-a', templates: ['A', 'C'] })).toBe(false)
  })

  it('is not current without a preview', () => {
    expect(previewIsCurrent(null, { namespace: 'ns-a', templates: [] })).toBe(false)
  })
})

describe('applyBlockReason', () => {
  it('asks for a preview when there is none, or only an applied result', () => {
    expect(applyBlockReason(null, true)).toMatch(/preview first/i)
    expect(applyBlockReason({ dry_run: false, changed: 3 }, true)).toMatch(/preview first/i)
  })

  it('asks for a new preview when the scope changed', () => {
    expect(applyBlockReason({ dry_run: true, changed: 3 }, false)).toMatch(/run it again/i)
  })

  it('says so when there is nothing to change', () => {
    expect(applyBlockReason({ dry_run: true, changed: 0 }, true)).toMatch(/nothing to change/i)
  })

  it('allows apply for a current preview with changes', () => {
    expect(applyBlockReason({ dry_run: true, changed: 2 }, true)).toBeNull()
  })
})

describe('registryOutcome', () => {
  it('is none when no re-key was attempted', () => {
    expect(registryOutcome({ registry_status: null })).toBe('none')
  })

  it('is ok when the Registry re-keyed the entry or already held the identity', () => {
    expect(registryOutcome({ registry_status: 'rekeyed' })).toBe('ok')
    expect(registryOutcome({ registry_status: 'unchanged' })).toBe('ok')
  })

  it('is failed for every Registry failure status and document-store\'s own', () => {
    // The Registry's re-key endpoint can answer not_found, conflict or error;
    // these used to be shown as neutral, with no failure alert.
    for (const s of ['not_found', 'conflict', 'error', 'missing', 'error: connection refused', 'Error: boom']) {
      expect(registryOutcome({ registry_status: s }), s).toBe('failed')
    }
  })

  it('treats a status it does not know as failed, never as success', () => {
    expect(registryOutcome({ registry_status: 'anything-else' })).toBe('failed')
  })
})

describe('summarizeRegistry', () => {
  it('counts each distinct status, most common first, and the failures', () => {
    const s = summarizeRegistry([
      { registry_status: 'rekeyed' },
      { registry_status: 'rekeyed' },
      { registry_status: 'missing' },
      { registry_status: 'error: x' },
      { registry_status: 'conflict' },
      { registry_status: 'unchanged' },
      { registry_status: null },
    ])
    expect(s.attempted).toBe(6)
    expect(s.failed).toBe(3)
    expect(s.byStatus).toEqual([
      { status: 'rekeyed', count: 2, failed: false },
      { status: 'conflict', count: 1, failed: true },
      { status: 'error: x', count: 1, failed: true },
      { status: 'missing', count: 1, failed: true },
      { status: 'unchanged', count: 1, failed: false },
    ])
  })

  it('is empty for a dry run', () => {
    expect(summarizeRegistry([{ registry_status: null }, { registry_status: null }])).toEqual({
      byStatus: [],
      failed: 0,
      attempted: 0,
    })
  })
})

describe('shortHash', () => {
  it('cuts long hashes to eight characters and marks the cut', () => {
    expect(shortHash('0123456789abcdef')).toBe('01234567…')
  })

  it('leaves short values and shows a dash for none', () => {
    expect(shortHash('abc')).toBe('abc')
    expect(shortHash(null)).toBe('—')
    expect(shortHash('')).toBe('—')
  })
})
