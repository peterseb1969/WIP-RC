import type { RegisteredView } from '@wip/client'

// Helpers for registered reporting views — named, read-only SQL views a
// namespace keeps in its PostgreSQL reporting schema (reporting-sync
// /namespace/{ns}/views). They are not part of the /tables inventory, so the
// console lists them per namespace and renders them on their own surface.

/** registered_by stamp for views created or replaced from this console. */
export const CONSOLE_REGISTRANT = 'rc-console'

/**
 * `registered_by` value for a save from this console: `rc-console:<email|name>`,
 * or plain `rc-console` when no user is known (dev mode).
 */
export function consoleRegistrant(user?: { email?: string; name?: string } | null): string {
  const who = user?.email || user?.name
  return who ? `${CONSOLE_REGISTRANT}:${who}` : CONSOLE_REGISTRANT
}

/**
 * True when the view was registered from somewhere other than this console —
 * typically an app's bootstrap, which re-registers its views on every run and
 * would silently overwrite an edit made here.
 */
export function isExternallyOwned(view: Pick<RegisteredView, 'registered_by'>): boolean {
  const by = view.registered_by
  return !!by && by !== CONSOLE_REGISTRANT && !by.startsWith(`${CONSOLE_REGISTRANT}:`)
}

/** Drop trailing semicolons/whitespace — the server tolerates one, a subquery does not. */
export function stripTrailingSemicolons(sql: string): string {
  return sql.replace(/[\s;]+$/, '')
}

/**
 * Wrap a candidate view definition so it can be test-run as a bounded query
 * before registering. Runs with the view's namespace as search_path, exactly
 * like the registered view will.
 */
export function previewSql(sql: string, limit = 50): string {
  return `SELECT * FROM (\n${stripTrailingSemicolons(sql)}\n) AS _rc_preview LIMIT ${limit}`
}

/** Query that reads a registered view, schema-qualified so it runs from any namespace. */
export function selectFromView(view: Pick<RegisteredView, 'namespace' | 'name'>, limit = 100): string {
  return `SELECT * FROM ${quoteIdent(view.namespace)}.${quoteIdent(view.name)} LIMIT ${limit}`
}

/**
 * Double-quote a PostgreSQL identifier, doubling embedded quotes. Namespace
 * prefixes may contain hyphens (dev-wip-reactconsole), which are not valid in
 * an unquoted identifier.
 */
export function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`
}

/** Stable identity for a view in the UI — names are only unique within a namespace. */
export function viewKey(view: Pick<RegisteredView, 'namespace' | 'name'>): string {
  return `${view.namespace}/${view.name}`
}

/** Filter by namespace (empty = all) and a case-insensitive name/SQL substring. */
export function filterViews(views: RegisteredView[], namespace: string, query: string): RegisteredView[] {
  const q = query.trim().toLowerCase()
  return views.filter(v =>
    (!namespace || v.namespace === namespace) &&
    (!q || v.name.toLowerCase().includes(q) || v.sql.toLowerCase().includes(q)),
  )
}
