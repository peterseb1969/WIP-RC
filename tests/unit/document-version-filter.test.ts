import { describe, it, expect } from 'vitest'
import { parseVersionParam, versionOptions, versionQuery } from '@/lib/document-version-filter'

// Filtering the documents list by template version: the URL value, the versions
// offered, and the query sent. The list endpoint cannot filter by version, so
// the filter uses the query endpoint, which with status active returns one row
// per live document (asked for inactive it would return history rows).

describe('parseVersionParam', () => {
  it('accepts a positive integer', () => {
    expect(parseVersionParam('1')).toBe(1)
    expect(parseVersionParam('12')).toBe(12)
  })

  it('rejects anything else as no filter', () => {
    for (const raw of [null, '', '0', '-1', '1.5', 'v2', ' 2']) {
      expect(parseVersionParam(raw), String(raw)).toBeNull()
    }
  })
})

describe('versionOptions', () => {
  it('offers every version up to the latest, newest first', () => {
    expect(versionOptions(3)).toEqual([3, 2, 1])
    expect(versionOptions(1)).toEqual([1])
  })

  it('offers nothing without a known latest version', () => {
    expect(versionOptions(null)).toEqual([])
    expect(versionOptions(undefined)).toEqual([])
    expect(versionOptions(0)).toEqual([])
  })
})

describe('versionQuery', () => {
  it('asks for live documents of the template pinned to the version', () => {
    expect(versionQuery('tpl-1', 2, 3, 25, { sortBy: 'updated_at', sortOrder: 'desc' })).toEqual({
      template_id: 'tpl-1',
      status: 'active',
      filters: [{ field: 'template_version', operator: 'eq', value: 2 }],
      page: 3,
      page_size: 25,
      sort_by: 'updated_at',
      sort_order: 'desc',
    })
  })
})
