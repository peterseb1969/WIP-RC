import { describe, it, expect } from 'vitest'
import {
  DB_OVERRIDES_SQL,
  DB_SESSION_SQL,
  DB_SETTINGS_SQL,
  categoriesOf,
  contextInfo,
  filterSettings,
  formatValue,
  isNotDefault,
  overrideAppliesTo,
  sourceText,
  splitOverride,
  toOverride,
  toSession,
  toSetting,
  type PgSetting,
} from '@/lib/db-settings'

function setting(over: Partial<PgSetting> = {}): PgSetting {
  return {
    name: 'work_mem',
    setting: '4096',
    unit: 'kB',
    category: 'Resource Usage / Memory',
    short_desc: 'Sets the maximum memory to be used for query workspaces.',
    context: 'user',
    vartype: 'integer',
    source: 'default',
    boot_val: '4096',
    reset_val: '4096',
    pending_restart: false,
    min_val: '64',
    max_val: '2147483647',
    enumvals: null,
    ...over,
  }
}

describe('the queries', () => {
  // The reporting endpoint refuses a statement that contains any of these as a
  // word, even inside a string or function argument.
  const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i

  it.each([
    ['settings', DB_SETTINGS_SQL],
    ['overrides', DB_OVERRIDES_SQL],
    ['session', DB_SESSION_SQL],
  ])('the %s query contains no write or DDL word', (_name, sql) => {
    expect(sql).not.toMatch(FORBIDDEN)
    expect(sql.trim().toUpperCase().startsWith('SELECT')).toBe(true)
    expect(sql).not.toContain(';')
  })
})

describe('row mappers', () => {
  it('maps a settings row, keeping nulls and arrays', () => {
    const s = toSetting({
      name: 'jit', setting: 'off', unit: null, category: 'Query Tuning', short_desc: 'Allow JIT.',
      context: 'user', vartype: 'bool', source: 'database', boot_val: 'on', reset_val: 'off',
      pending_restart: false, min_val: null, max_val: null, enumvals: null,
    })
    expect(s).toMatchObject({ name: 'jit', setting: 'off', unit: null, source: 'database', boot_val: 'on', enumvals: null })
    expect(toSetting({ name: 'x', enumvals: ['a', 'b'] }).enumvals).toEqual(['a', 'b'])
  })

  it('maps overrides and the session', () => {
    expect(toOverride({ role: 'r', database: 'd', setting: 'jit=off' })).toEqual({ role: 'r', database: 'd', setting: 'jit=off' })
    expect(toSession(undefined)).toBeNull()
    expect(toSession({ role: 'r', database: 'd', version: 'PostgreSQL 16', session_started: null })).toEqual({
      role: 'r', database: 'd', version: 'PostgreSQL 16', session_started: null,
    })
  })

  it('treats only a real true as pending a restart', () => {
    expect(toSetting({ pending_restart: true }).pending_restart).toBe(true)
    expect(toSetting({ pending_restart: 't' }).pending_restart).toBe(false)
  })
})

describe('formatValue', () => {
  it('appends the unit, and marks an empty value', () => {
    expect(formatValue({ setting: '300000', unit: 'ms' })).toBe('300000 ms')
    expect(formatValue({ setting: 'off', unit: null })).toBe('off')
    expect(formatValue({ setting: '', unit: null })).toBe('(empty)')
  })
})

describe('contextInfo', () => {
  it('says what it takes to change a setting', () => {
    expect(contextInfo('user').label).toBe('Session, role or database')
    expect(contextInfo('sighup').label).toBe('Config reload')
    expect(contextInfo('postmaster').label).toBe('Server restart')
    expect(contextInfo('internal').label).toBe('Fixed')
    expect(contextInfo('superuser').label).toBe('Administrator')
  })

  it('groups the two connection-start contexts and shows an unknown one as is', () => {
    expect(contextInfo('backend').label).toBe(contextInfo('superuser-backend').label)
    expect(contextInfo('weird').label).toBe('weird')
  })
})

describe('sourceText and isNotDefault', () => {
  it('reads sources in plain language, falling back to the raw value', () => {
    expect(sourceText('database')).toBe('Default set on the database')
    expect(sourceText('configuration file')).toMatch(/configuration file/i)
    expect(sourceText('something new')).toBe('something new')
  })

  it('is not-default for anything but the built-in default', () => {
    expect(isNotDefault({ source: 'default' })).toBe(false)
    expect(isNotDefault({ source: 'database' })).toBe(true)
    expect(isNotDefault({ source: 'override' })).toBe(true)
  })
})

describe('filterSettings and categoriesOf', () => {
  const rows = [
    setting(),
    setting({ name: 'jit', setting: 'off', unit: null, category: 'Query Tuning / Other Planner Options', short_desc: 'Allow JIT compilation.', source: 'database' }),
    setting({ name: 'jit_above_cost', setting: '100000', unit: null, category: 'Query Tuning / Other Planner Options', short_desc: 'Perform JIT compilation if query is more expensive.' }),
  ]

  it('matches name, description and category, ignoring case', () => {
    expect(filterSettings(rows, { query: 'JIT', notDefaultOnly: false, category: '' }).map(s => s.name)).toEqual(['jit', 'jit_above_cost'])
    expect(filterSettings(rows, { query: 'query workspaces', notDefaultOnly: false, category: '' }).map(s => s.name)).toEqual(['work_mem'])
    expect(filterSettings(rows, { query: 'planner options', notDefaultOnly: false, category: '' })).toHaveLength(2)
  })

  it('shows only settings not at default when asked', () => {
    expect(filterSettings(rows, { query: '', notDefaultOnly: true, category: '' }).map(s => s.name)).toEqual(['jit'])
  })

  it('limits to one category and combines with the other filters', () => {
    const cat = 'Query Tuning / Other Planner Options'
    expect(filterSettings(rows, { query: '', notDefaultOnly: false, category: cat })).toHaveLength(2)
    expect(filterSettings(rows, { query: 'above', notDefaultOnly: true, category: cat })).toEqual([])
  })

  it('lists categories once, sorted', () => {
    expect(categoriesOf(rows)).toEqual(['Query Tuning / Other Planner Options', 'Resource Usage / Memory'])
  })
})

describe('overrides', () => {
  it('splits at the first equals sign only', () => {
    expect(splitOverride('jit=off')).toEqual({ name: 'jit', value: 'off' })
    expect(splitOverride('search_path=a=b')).toEqual({ name: 'search_path', value: 'a=b' })
    expect(splitOverride('flag')).toEqual({ name: 'flag', value: '' })
  })

  const session = { role: 'wip_reporting_read', database: 'wip_reporting' }

  it('applies when role and database both cover the session', () => {
    expect(overrideAppliesTo({ role: '(all roles)', database: 'wip_reporting' }, session)).toBe(true)
    expect(overrideAppliesTo({ role: 'wip_reporting_read', database: '(all databases)' }, session)).toBe(true)
    expect(overrideAppliesTo({ role: '(all roles)', database: '(all databases)' }, session)).toBe(true)
  })

  it('does not apply to another role or database', () => {
    expect(overrideAppliesTo({ role: 'wip_sync_owner', database: '(all databases)' }, session)).toBe(false)
    expect(overrideAppliesTo({ role: '(all roles)', database: 'other_db' }, session)).toBe(false)
  })
})
