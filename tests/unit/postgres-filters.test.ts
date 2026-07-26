import { describe, it, expect } from 'vitest'
import type { ReportTable, ReportEntity } from '@/hooks/use-reporting'
import {
  tablePasses,
  nameMatches,
  visibleEntityRelations,
  VERSION_TABLE_RE,
  type BrowserFilters,
} from '@/pages/PostgresPage'

// Pure filtering logic behind the CASE-812 Table Browser filter bar. What is
// under test is the predicates, not the React tree — the two "hide" toggles
// default ON, so a fixture with a version table + an empty table exercises the
// common noise cases.

const tbl = (name: string, over: Partial<ReportTable> = {}): ReportTable => ({
  namespace: 'kb',
  name,
  template_value: name.toUpperCase(),
  qualified_name: `"kb"."${name}"`,
  row_count: 5,
  column_count: 3,
  kind: 'table',
  ...over,
})

const F = (o: Partial<BrowserFilters> = {}): BrowserFilters => ({
  namespaces: [],
  query: '',
  hideVersions: true,
  hideEmpty: true,
  kind: 'all',
  ...o,
})

describe('VERSION_TABLE_RE', () => {
  it('matches doc_*__vN suffixes only', () => {
    expect(VERSION_TABLE_RE.test('doc_case_record__v1')).toBe(true)
    expect(VERSION_TABLE_RE.test('doc_case_record__v12')).toBe(true)
    expect(VERSION_TABLE_RE.test('doc_case_record')).toBe(false)
    expect(VERSION_TABLE_RE.test('doc_case_record__entities')).toBe(false)
  })
})

describe('tablePasses', () => {
  it('hides per-version tables when hideVersions is on (default)', () => {
    expect(tablePasses(tbl('doc_x__v1'), F())).toBe(false)
    expect(tablePasses(tbl('doc_x__v1'), F({ hideVersions: false }))).toBe(true)
  })

  it('hides empty tables when hideEmpty is on (default)', () => {
    expect(tablePasses(tbl('doc_x', { row_count: 0 }), F())).toBe(false)
    expect(tablePasses(tbl('doc_x', { row_count: 0 }), F({ hideEmpty: false }))).toBe(true)
  })

  it('filters by kind, treating a missing kind as a physical table', () => {
    const view = tbl('doc_x', { kind: 'view' })
    const table = tbl('doc_x_tbl', { kind: 'table' })
    const legacy = tbl('doc_x_legacy', { kind: undefined })
    expect(tablePasses(view, F({ kind: 'view' }))).toBe(true)
    expect(tablePasses(table, F({ kind: 'view' }))).toBe(false)
    expect(tablePasses(legacy, F({ kind: 'view' }))).toBe(false) // missing kind => table
    expect(tablePasses(legacy, F({ kind: 'table' }))).toBe(true)
    expect(tablePasses(table, F({ kind: 'all' }))).toBe(true)
  })
})

describe('nameMatches', () => {
  it('is a case-insensitive substring, and empty query matches everything', () => {
    expect(nameMatches('doc_case_record', 'case')).toBe(true)
    expect(nameMatches('doc_CASE_record', 'case')).toBe(true)
    expect(nameMatches('doc_case_record', '')).toBe(true)
    expect(nameMatches('doc_case_record', 'xyz')).toBe(false)
  })
})

describe('visibleEntityRelations', () => {
  const entity: ReportEntity = {
    namespace: 'kb',
    entity: 'case_record',
    default_view: 'doc_case_record',
    default_view_present: true,
    entities_view: 'doc_case_record__entities',
    legacy_table: false,
    versions: [
      { version: 1, table: 'doc_case_record__v1', row_count: 10 },
      { version: 2, table: 'doc_case_record__v2', row_count: 5 },
    ],
    row_count: 15,
  }
  const index = new Map<string, ReportTable>([
    ['kb|doc_case_record', tbl('doc_case_record', { kind: 'view', row_count: 15 })],
    ['kb|doc_case_record__entities', tbl('doc_case_record__entities', { kind: 'view', row_count: 15 })],
    ['kb|doc_case_record__v1', tbl('doc_case_record__v1', { kind: 'table', row_count: 10 })],
    ['kb|doc_case_record__v2', tbl('doc_case_record__v2', { kind: 'table', row_count: 5 })],
  ])

  it('shows only the two views by default (versions hidden), with the entity a name-hit on empty query', () => {
    const { entityHit, relations } = visibleEntityRelations(entity, index, F())
    expect(entityHit).toBe(true)
    expect(relations.map(r => r.table.name)).toEqual(['doc_case_record', 'doc_case_record__entities'])
  })

  it('includes version tables when hideVersions is off', () => {
    const { relations } = visibleEntityRelations(entity, index, F({ hideVersions: false }))
    expect(relations.map(r => r.table.name)).toEqual([
      'doc_case_record',
      'doc_case_record__entities',
      'doc_case_record__v1',
      'doc_case_record__v2',
    ])
  })

  it('when the query hits only a child table, shows just the matching child', () => {
    const { entityHit, relations } = visibleEntityRelations(
      entity,
      index,
      F({ query: 'v1', hideVersions: false })
    )
    expect(entityHit).toBe(false)
    expect(relations.map(r => r.table.name)).toEqual(['doc_case_record__v1'])
  })

  it('when the query hits the entity name, shows all filter-passing relations', () => {
    const { entityHit, relations } = visibleEntityRelations(entity, index, F({ query: 'case' }))
    expect(entityHit).toBe(true)
    // versions still hidden by the default toggle
    expect(relations.map(r => r.table.name)).toEqual(['doc_case_record', 'doc_case_record__entities'])
  })

  it('drops empty relations when hideEmpty is on', () => {
    const withEmptyView = new Map(index)
    withEmptyView.set('kb|doc_case_record', tbl('doc_case_record', { kind: 'view', row_count: 0 }))
    const { relations } = visibleEntityRelations(entity, withEmptyView, F())
    expect(relations.map(r => r.table.name)).toEqual(['doc_case_record__entities'])
  })
})
