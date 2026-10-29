// Read-only view of the reporting database's configuration, as the reporting
// role sees it. The queries run through the reporting query endpoint, which
// refuses statements by keyword, so none of the SQL below may contain a
// write or DDL word (a test guards that).

// The session's identity rides on every settings row. The endpoint pools its
// connections, so a separate query for the session can be answered by another
// connection (with another start time and possibly other values); one
// statement guarantees the values and the session described are the same one.
export const DB_SETTINGS_SQL =
  'SELECT p.name, p.setting, p.unit, p.category, p.short_desc, p.context, p.vartype, p.source, p.boot_val, ' +
  'p.reset_val, p.pending_restart, p.min_val, p.max_val, p.enumvals, ' +
  'x.session_role, x.session_database, x.session_version, x.session_started FROM pg_settings p ' +
  'CROSS JOIN (SELECT current_user AS session_role, current_database() AS session_database, ' +
  'version() AS session_version, ' +
  '(SELECT backend_start FROM pg_stat_activity WHERE pid = pg_backend_pid()) AS session_started) x ' +
  'ORDER BY p.category, p.name'

// One row per name=value pair a role and/or database carries as its own default.
export const DB_OVERRIDES_SQL =
  "SELECT coalesce(r.rolname, '(all roles)') AS role, coalesce(d.datname, '(all databases)') AS database, " +
  'unnest(s.setconfig) AS setting FROM pg_db_role_setting s ' +
  'LEFT JOIN pg_roles r ON r.oid = s.setrole LEFT JOIN pg_database d ON d.oid = s.setdatabase ORDER BY 1, 2, 3'

export const ALL_OVERRIDES_SCOPE = { roles: '(all roles)', databases: '(all databases)' } as const

export interface PgSetting {
  name: string
  setting: string
  unit: string | null
  category: string
  short_desc: string
  context: string
  vartype: string
  source: string
  boot_val: string | null
  reset_val: string | null
  pending_restart: boolean
  min_val: string | null
  max_val: string | null
  enumvals: string[] | null
}

export interface PgOverride {
  role: string
  database: string
  /** `name=value`, as PostgreSQL stores it. */
  setting: string
}

export interface DbSession {
  role: string
  database: string
  version: string
  session_started: string | null
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))

export function toSetting(row: Record<string, unknown>): PgSetting {
  return {
    name: str(row.name),
    setting: str(row.setting),
    unit: strOrNull(row.unit),
    category: str(row.category),
    short_desc: str(row.short_desc),
    context: str(row.context),
    vartype: str(row.vartype),
    source: str(row.source),
    boot_val: strOrNull(row.boot_val),
    reset_val: strOrNull(row.reset_val),
    pending_restart: row.pending_restart === true,
    min_val: strOrNull(row.min_val),
    max_val: strOrNull(row.max_val),
    enumvals: Array.isArray(row.enumvals) ? row.enumvals.map(String) : null,
  }
}

export function toOverride(row: Record<string, unknown>): PgOverride {
  return { role: str(row.role), database: str(row.database), setting: str(row.setting) }
}

/** The session that read the settings, from the session columns of a settings row; null without one. */
export function toSession(row: Record<string, unknown> | undefined): DbSession | null {
  if (!row) return null
  return {
    role: str(row.session_role),
    database: str(row.session_database),
    version: str(row.session_version),
    session_started: strOrNull(row.session_started),
  }
}

/** A value with its unit, e.g. "300000 ms"; "(empty)" for an empty string. */
export function formatValue(s: Pick<PgSetting, 'setting' | 'unit'>): string {
  if (s.setting === '') return '(empty)'
  return s.unit ? `${s.setting} ${s.unit}` : s.setting
}

export interface ContextInfo {
  label: string
  hint: string
}

/**
 * What it takes to change a setting, from its PostgreSQL context. Only `user`
 * settings can be given a default for a role or database; the rest are the
 * server's own configuration.
 */
export function contextInfo(context: string): ContextInfo {
  switch (context) {
    case 'user':
      return {
        label: 'Session, role or database',
        hint: 'Any role can set it for its own session. A default for a role or database needs the database owner or an administrator, and reaches sessions that start afterwards.',
      }
    case 'superuser':
      return { label: 'Administrator', hint: 'Only a superuser can change it, for a session, role or database.' }
    case 'sighup':
      return { label: 'Config reload', hint: 'Set in the server configuration; a reload applies it, no restart.' }
    case 'postmaster':
      return { label: 'Server restart', hint: 'Set in the server configuration; it takes effect when the server restarts.' }
    case 'backend':
    case 'superuser-backend':
      return { label: 'Connection start', hint: 'Fixed when a connection is made; it cannot change within a session.' }
    case 'internal':
      return { label: 'Fixed', hint: 'Determined when the server was built or initialised; it cannot be changed.' }
    default:
      return { label: context || 'Unknown', hint: '' }
  }
}

const SOURCE_TEXT: Record<string, string> = {
  default: 'Built-in default',
  'configuration file': 'Server configuration file or ALTER SYSTEM',
  'command line': 'Server start-up options',
  'environment variable': 'Environment variable',
  database: 'Default set on the database',
  user: 'Default set on the role',
  'database user': 'Default set on this role in this database',
  client: 'Chosen by the connecting client',
  session: 'Set within the session',
  override: 'Overridden by the server',
  global: 'Server-wide default',
}

/** Plain-language reading of where a value comes from. */
export function sourceText(source: string): string {
  return SOURCE_TEXT[source] ?? source
}

/** Whether a setting's value comes from anywhere other than the built-in default. */
export function isNotDefault(s: Pick<PgSetting, 'source'>): boolean {
  return s.source !== 'default'
}

export interface SettingsFilter {
  query: string
  notDefaultOnly: boolean
  /** Exact category; empty means all. */
  category: string
}

/** Settings matching the filter; the query matches name, description and category, ignoring case. */
export function filterSettings(rows: readonly PgSetting[], f: SettingsFilter): PgSetting[] {
  const q = f.query.trim().toLowerCase()
  return rows.filter(s => {
    if (f.notDefaultOnly && !isNotDefault(s)) return false
    if (f.category && s.category !== f.category) return false
    if (!q) return true
    return (
      s.name.toLowerCase().includes(q) ||
      s.short_desc.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    )
  })
}

/** Distinct categories, sorted. */
export function categoriesOf(rows: readonly PgSetting[]): string[] {
  return [...new Set(rows.map(s => s.category))].sort((a, b) => a.localeCompare(b))
}

/** Splits `name=value` at the first `=`; values may contain `=`. */
export function splitOverride(setting: string): { name: string; value: string } {
  const i = setting.indexOf('=')
  return i < 0 ? { name: setting, value: '' } : { name: setting.slice(0, i), value: setting.slice(i + 1) }
}

/** Whether an override's role and database scope covers the session that read the settings. */
export function overrideAppliesTo(o: Pick<PgOverride, 'role' | 'database'>, session: Pick<DbSession, 'role' | 'database'>): boolean {
  const roleOk = o.role === ALL_OVERRIDES_SCOPE.roles || o.role === session.role
  const dbOk = o.database === ALL_OVERRIDES_SCOPE.databases || o.database === session.database
  return roleOk && dbOk
}
