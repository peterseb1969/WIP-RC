/**
 * Tests for the registered-view helpers: preview wrapping, view read SQL,
 * ownership detection, and list filtering.
 */
import { describe, it, expect } from 'vitest'
import type { RegisteredView } from '@wip/client'
import {
  consoleRegistrant,
  filterViews,
  isExternallyOwned,
  previewSql,
  quoteIdent,
  selectFromView,
  stripTrailingSemicolons,
} from '../../src/lib/registered-views'

const view = (namespace: string, name: string, sql = 'SELECT 1', registered_by: string | null = null): RegisteredView => ({
  namespace,
  name,
  sql,
  registered_at: null,
  registered_by,
})

describe('previewSql', () => {
  it('wraps the definition as a bounded subquery', () => {
    expect(previewSql('SELECT a FROM doc_x', 10)).toBe('SELECT * FROM (\nSELECT a FROM doc_x\n) AS _rc_preview LIMIT 10')
  })

  it('strips trailing semicolons the server would tolerate but a subquery would not', () => {
    expect(stripTrailingSemicolons('SELECT 1 ;\n ;  ')).toBe('SELECT 1')
    expect(previewSql('WITH t AS (SELECT 1) SELECT * FROM t;')).toContain('SELECT * FROM t\n) AS _rc_preview')
  })
})

describe('selectFromView', () => {
  it('schema-qualifies with quoted identifiers so it runs from any namespace', () => {
    expect(selectFromView(view('dev-wip-reactconsole', 'v_terms'), 5)).toBe(
      'SELECT * FROM "dev-wip-reactconsole"."v_terms" LIMIT 5',
    )
  })

  it('escapes embedded double quotes', () => {
    expect(quoteIdent('we"ird')).toBe('"we""ird"')
  })
})

describe('ownership', () => {
  it('stamps console registrations with the user when known', () => {
    expect(consoleRegistrant({ email: 'admin@wip.local' })).toBe('rc-console:admin@wip.local')
    expect(consoleRegistrant(null)).toBe('rc-console')
  })

  it('treats views registered by anything but the console as externally owned', () => {
    expect(isExternallyOwned(view('ct', 'v', 'SELECT 1', 'clintrial-bootstrap'))).toBe(true)
    expect(isExternallyOwned(view('ct', 'v', 'SELECT 1', 'rc-console'))).toBe(false)
    expect(isExternallyOwned(view('ct', 'v', 'SELECT 1', 'rc-console:admin@wip.local'))).toBe(false)
    expect(isExternallyOwned(view('ct', 'v', 'SELECT 1', null))).toBe(false)
    // A prefix lookalike is not the console.
    expect(isExternallyOwned(view('ct', 'v', 'SELECT 1', 'rc-console-fork'))).toBe(true)
  })
})

describe('filterViews', () => {
  const all = [
    view('kb', 'v_open_cases', 'SELECT * FROM doc_case_record'),
    view('ct', 'v_study_search', 'SELECT * FROM doc_ct_study'),
    view('ct', 'v_sites'),
  ]

  it('filters by namespace', () => {
    expect(filterViews(all, 'ct', '').map(v => v.name)).toEqual(['v_study_search', 'v_sites'])
  })

  it('matches name or SQL, case-insensitively', () => {
    expect(filterViews(all, '', 'CASE_RECORD').map(v => v.name)).toEqual(['v_open_cases'])
    expect(filterViews(all, '', 'sites').map(v => v.name)).toEqual(['v_sites'])
  })

  it('returns everything for an empty filter', () => {
    expect(filterViews(all, '', '  ')).toHaveLength(3)
  })
})
