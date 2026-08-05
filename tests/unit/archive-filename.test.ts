import { describe, it, expect } from 'vitest'
import { archiveFilename } from '@/pages/BackupRestorePage'

// The combined-archive filename used to emit a count ("kb+1ns" -> kb_1ns after
// sanitizing), which mislabels which namespaces are inside. Peter's spec: list
// them. These pin that, plus the single-namespace case and the whole-instance
// bound.
const T = { completed_at: '2026-07-22T11:27:44', created_at: '2026-07-22T11:27:40' }

describe('archiveFilename', () => {
  it('names a single-namespace archive by that namespace', () => {
    expect(archiveFilename({ ...T, namespace: 'clintrial', namespaces: ['clintrial'] }))
      .toBe('clintrial_2026-07-22_112744.zip')
  })

  it('falls back to the bare namespace when namespaces is absent', () => {
    expect(archiveFilename({ ...T, namespace: 'kb' }))
      .toBe('kb_2026-07-22_112744.zip')
  })

  it('LISTS every namespace in a combined archive (the bug)', () => {
    // Was: kb_1ns_… — a count, not the names.
    expect(archiveFilename({ ...T, namespace: 'kb', namespaces: ['kb', 'library'] }))
      .toBe('kb_library_2026-07-22_112744.zip')
  })

  it('lists several namespaces, preserving order (anchor first)', () => {
    expect(archiveFilename({ ...T, namespace: 'kb', namespaces: ['kb', 'library', 'clintrial'] }))
      .toBe('kb_library_clintrial_2026-07-22_112744.zip')
  })

  it('keeps hyphenated namespace names intact', () => {
    expect(archiveFilename({ ...T, namespace: 'dev-golden-boot', namespaces: ['dev-golden-boot', 'kb'] }))
      .toBe('dev-golden-boot_kb_2026-07-22_112744.zip')
  })

  it('bounds a whole-instance archive instead of a 300-char name', () => {
    const many = Array.from({ length: 20 }, (_, i) => `namespace-number-${i}`)
    const name = archiveFilename({ ...T, namespace: many[0], namespaces: many })
    expect(name.length).toBeLessThan(100)
    expect(name).toMatch(/_and_\d+_more_2026-07-22_112744\.zip$/)
    // The leading names are still there.
    expect(name.startsWith('namespace-number-0_')).toBe(true)
  })

  it('falls back to a stamp of "unknown" when the job carries no timestamp', () => {
    expect(archiveFilename({ namespace: 'kb', namespaces: ['kb'] }))
      .toBe('kb_unknown.zip')
  })

  it('prefers completion time over creation time', () => {
    expect(archiveFilename({ namespace: 'kb', namespaces: ['kb'], completed_at: '2026-01-02T03:04:05', created_at: '2025-12-31T23:59:59' }))
      .toBe('kb_2026-01-02_030405.zip')
  })
})
