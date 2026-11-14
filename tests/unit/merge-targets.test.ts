import { describe, it, expect } from 'vitest'
import { mergeTargetField, mergeTargets } from '@/pages/BackupRestorePage'

// A merge writes into existing namespaces. A multi-namespace archive merges
// each namespace into the one of the same name, and the platform refuses a
// target_namespace for it (400); a single-namespace archive may be redirected.

describe('mergeTargets', () => {
  it('is every source for a multi-namespace archive, whatever the target field holds', () => {
    expect(mergeTargets(['kb', 'library'], '')).toEqual(['kb', 'library'])
    expect(mergeTargets(['kb', 'library'], 'other')).toEqual(['kb', 'library'])
  })

  it('is the redirect, else the archive\'s own namespace, for a single-namespace archive', () => {
    expect(mergeTargets(['kb'], '')).toEqual(['kb'])
    expect(mergeTargets(['kb'], ' kb-copy ')).toEqual(['kb-copy'])
    expect(mergeTargets([], '')).toEqual([])
  })
})

describe('mergeTargetField', () => {
  it('is never sent for a multi-namespace archive', () => {
    expect(mergeTargetField(['kb', 'library'], 'kb')).toBeNull()
    expect(mergeTargetField(['kb', 'library'], 'other')).toBeNull()
  })

  it('is sent only to redirect a single-namespace archive', () => {
    expect(mergeTargetField(['kb'], '')).toBeNull()
    expect(mergeTargetField(['kb'], 'kb')).toBeNull()
    expect(mergeTargetField(['kb'], ' kb-copy ')).toBe('kb-copy')
  })
})
