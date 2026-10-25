import { matchPath } from 'react-router-dom'

/**
 * Whether the top-bar namespace selector does anything on a given page.
 *
 * The selector is an allowlist, not a blocklist: it is live only on pages that
 * read it — list pages it filters, and the create flows it scopes (template
 * builder, document form and import). Everywhere else it is shown disabled with
 * the reason, so it never looks active on a page that ignores it. A new page is
 * therefore "doesn't apply" until it is added here deliberately.
 */
export type NamespaceScope =
  | { applies: true }
  | { applies: false; reason: string }

// Patterns are matched exactly (react-router `matchPath`, end: true), so
// '/documents/:templateValue/new' does not also claim the detail page.
const APPLIES: string[] = [
  '/',
  '/terminologies',
  '/templates',
  '/templates/new',
  '/documents',
  '/documents/import',
  '/documents/:templateValue/table',
  '/documents/:templateValue/new',
  '/files',
  '/registry',
  '/backup',
]

// Infrastructure inspection reads across the whole WIP instance.
const INFRASTRUCTURE: string[] = ['/postgres', '/mongodb', '/nats']

// Detail and edit pages show one entity, in the entity's own namespace.
const SINGLE_ENTITY: string[] = [
  '/terminologies/:id',
  '/terminologies/:tid/terms/:termId',
  '/templates/:id',
  '/templates/:id/edit',
  '/documents/:templateValue/:id',
  '/documents/:templateValue/:id/edit',
  '/files/:id',
]

const matches = (patterns: string[], pathname: string) =>
  patterns.some(p => matchPath({ path: p, end: true }, pathname) !== null)

// Prefix match for infrastructure pages, which may grow sub-routes.
const underInfrastructure = (pathname: string) =>
  INFRASTRUCTURE.some(p => pathname === p || pathname.startsWith(`${p}/`))

export function namespaceScope(pathname: string): NamespaceScope {
  if (matches(APPLIES, pathname)) return { applies: true }
  if (underInfrastructure(pathname)) {
    return { applies: false, reason: 'The namespace filter does not apply on this page — data is shown across all namespaces.' }
  }
  if (matches(SINGLE_ENTITY, pathname)) {
    return { applies: false, reason: 'The namespace filter does not apply on this page — it shows one item in its own namespace.' }
  }
  return { applies: false, reason: 'The namespace filter does not apply on this page.' }
}
