import { describe, it, expect } from 'vitest'
import { templateCounts, termCounts } from '@/lib/namespace-counts'

// A namespace's contents as live and retired. Templates are versioned, so a
// template is live while any version is active; terms are live by their
// terminologies' active counts, and the rest of the Registry's terms are
// deprecated.

describe('templateCounts', () => {
  it('counts a template once, live while any version is active', () => {
    expect(templateCounts([
      { value: 'A', status: 'inactive' }, // superseded v1
      { value: 'A', status: 'active' },   // live v2
      { value: 'B', status: 'active' },
      { value: 'C', status: 'inactive' }, // every version deactivated
      { value: 'C', status: 'inactive' },
    ])).toEqual({ active: 2, retired: 1 })
  })

  it('is empty for no templates', () => {
    expect(templateCounts([])).toEqual({ active: 0, retired: 0 })
  })
})

describe('termCounts', () => {
  it('sums active terms and derives the deprecated ones from the Registry', () => {
    expect(termCounts([16, 3, null, undefined, 6], 30)).toEqual({ active: 25, retired: 5 })
  })

  it('never reports a negative retired count, and none without a Registry figure', () => {
    expect(termCounts([10], 8)).toEqual({ active: 10, retired: 0 })
    expect(termCounts([10], undefined)).toEqual({ active: 10, retired: 0 })
  })
})
