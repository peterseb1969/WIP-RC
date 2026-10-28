import { describe, it, expect } from 'vitest'
import { olderVersionsField } from '@/pages/BackupRestorePage'

// A merge that appends the archive's version (overwrite, newer) asks what
// happens to the target's older versions. The field goes out only where the
// choice is shown, so a request never carries a value the operator did not see,
// and never on a mode where the server refuses it.

describe('olderVersionsField', () => {
  it('sends the choice on a merge that overwrites or lets the newer win', () => {
    expect(olderVersionsField('merge', 'overwrite', 'retire')).toBe('retire')
    expect(olderVersionsField('merge', 'newer', 'keep')).toBe('keep')
  })

  it('sends nothing on a merge that skips clashes', () => {
    expect(olderVersionsField('merge', 'skip', 'keep')).toBeNull()
  })

  it('sends nothing outside merge mode', () => {
    expect(olderVersionsField('restore', 'overwrite', 'keep')).toBeNull()
    expect(olderVersionsField('fresh', 'newer', 'retire')).toBeNull()
  })
})
