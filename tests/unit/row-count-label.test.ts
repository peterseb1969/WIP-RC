import { describe, it, expect } from 'vitest'
import { rowCountLabel } from '@/pages/PostgresPage'

// The reporting layer leaves a row count null when it didn't take one (another
// kind of view, or a count that took too long). That must never read as 0.

describe('rowCountLabel', () => {
  it('shows a counted number', () => {
    expect(rowCountLabel(0, 'rows')).toBe('0 rows')
    expect(rowCountLabel(1234, 'docs')).toBe(`${(1234).toLocaleString()} docs`)
  })

  it('says "not counted" for null', () => {
    expect(rowCountLabel(null, 'rows')).toBe('rows not counted')
  })
})
