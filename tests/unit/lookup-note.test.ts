import { describe, it, expect } from 'vitest'
import { WipConflictError, WipNotFoundError, WipServerError } from '@wip/client'
import { lookupNote } from '@/lib/lookup-note'

// A stored value whose lookup failed is labelled by what the platform said:
// absent (404), naming several entities (409), or not answered (an outage).

describe('lookupNote', () => {
  it('tells absent, ambiguous and unanswered apart', () => {
    expect(lookupNote(new WipNotFoundError('no'))).toBe('not found')
    expect(lookupNote(new WipConflictError('two', { candidates: [], total: 2 }))).toBe('ambiguous')
    expect(lookupNote(new WipServerError('Registry unavailable; retry shortly', 503, { error_code: 'registry_unavailable' }))).toBe('lookup failed')
  })

  it('is empty without an error', () => {
    expect(lookupNote(null)).toBe('')
  })
})
